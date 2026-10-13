# SPDX-License-Identifier: AGPL-3.0-only
"""Single-process folder reservation edges, without importing a trainer."""

import ast
import errno
import sys
from contextlib import nullcontext
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest


@pytest.fixture
def reservation(tmp_path, monkeypatch):
    source = Path(__file__).resolve().parents[2] / "unsloth_cli/commands/train.py"
    tree = ast.parse(source.read_text(encoding="utf-8"))
    function = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "_default_output_dir"
    )
    paths = ModuleType("utils.paths")
    paths.default_run_dir_name = lambda model: "fixture-model"
    paths.resolve_output_dir = lambda name: tmp_path / name
    paths.ensure_dir = lambda path: path.mkdir(parents=True, exist_ok=True)
    bounds = ModuleType("studio.backend.core.training.dataset_bounds")
    bounds.world_size_from_env = lambda: 1
    monkeypatch.setitem(sys.modules, paths.__name__, paths)
    monkeypatch.setitem(sys.modules, bounds.__name__, bounds)
    namespace = {
        "ensure_studio_backend_path": lambda: None,
        "studio_backend_imports": lambda name: nullcontext(),
        "time": SimpleNamespace(time=lambda: 1000),
    }
    exec(
        compile(ast.Module(body=[function], type_ignores=[]), str(source), "exec"),
        namespace,
    )
    return namespace["_default_output_dir"], paths


def test_preexisting_file_and_directory_are_preserved(tmp_path, reservation):
    reserve, _ = reservation
    occupied_file = tmp_path / "fixture-model_1000"
    occupied_file.write_bytes(b"prior artifact")
    occupied_dir = tmp_path / "fixture-model_1001"
    occupied_dir.mkdir()
    marker = occupied_dir / "keep.txt"
    marker.write_bytes(b"prior run")

    result = Path(reserve("org/model"))

    assert result == tmp_path / "fixture-model_1002"
    assert result.is_dir()
    assert occupied_file.read_bytes() == b"prior artifact"
    assert marker.read_bytes() == b"prior run"
    assert sorted(path.name for path in tmp_path.iterdir()) == [
        "fixture-model_1000",
        "fixture-model_1001",
        "fixture-model_1002",
    ]
    print("file + directory collision -> _1002; both prior artifacts preserved")


def test_reservation_permission_error_propagates_once(tmp_path, monkeypatch, reservation):
    reserve, _ = reservation
    original_mkdir = Path.mkdir
    attempts = []

    def refuse_child(path, *args, **kwargs):
        if path.parent == tmp_path:
            attempts.append(path.name)
            raise PermissionError(errno.EACCES, "fixture reservation denied")
        return original_mkdir(path, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", refuse_child)
    with pytest.raises(PermissionError) as caught:
        reserve("org/model")

    assert caught.value.errno == errno.EACCES
    assert attempts == ["fixture-model_1000"]
    assert list(tmp_path.iterdir()) == []
    print("child mkdir -> errno13; one attempt, no output directory")


def test_parent_setup_error_propagates_once(tmp_path, monkeypatch, reservation):
    reserve, paths = reservation
    attempts = []

    def refuse_parent(path):
        attempts.append(path)
        raise OSError(errno.ENOSPC, "fixture parent exhausted")

    monkeypatch.setattr(paths, "ensure_dir", refuse_parent)
    with pytest.raises(OSError) as caught:
        reserve("org/model")

    assert caught.value.errno == errno.ENOSPC
    assert attempts == [tmp_path]
    assert list(tmp_path.iterdir()) == []
    print("parent setup -> errno28; one attempt, no output directory")
