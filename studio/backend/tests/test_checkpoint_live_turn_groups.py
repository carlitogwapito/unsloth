# SPDX-License-Identifier: AGPL-3.0-only
"""Boundary cases for selecting the tool exchanges of the turn in progress."""

from copy import deepcopy

import pytest

from core.inference.checkpoint import _live_turn_groups


def _exchange(*call_ids):
    return [
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": call_id,
                    "type": "function",
                    "function": {"name": "terminal", "arguments": "{}"},
                }
                for call_id in call_ids
            ],
        },
        *[
            {"role": "tool", "tool_call_id": call_id, "content": "same output"}
            for call_id in call_ids
        ],
    ]


@pytest.mark.parametrize(
    "messages",
    [
        [],
        [{"role": "system", "content": "rules"}, *_exchange("without-user")],
        [
            {"role": "user", "content": "old task"},
            *_exchange("old"),
            {"role": "user", "content": "new task"},
        ],
        [{"role": "user", "content": "task"}, *_exchange("only")],
    ],
    ids=["empty", "no-user", "new-user-only", "only-final-exchange"],
)
def test_no_additional_live_groups_are_needed(messages):
    before = deepcopy(messages)
    assert _live_turn_groups(messages) == []
    assert messages == before


def test_live_groups_start_after_the_newest_user_and_keep_original_objects():
    old = _exchange("old")
    live = _exchange("live")
    final = _exchange("final")
    messages = [
        {"role": "system", "content": "rules"},
        {"role": "user", "content": "old task"},
        *old,
        {"role": "user", "content": "new task"},
        *live,
        *final,
    ]
    before = deepcopy(messages)

    groups = _live_turn_groups(messages)

    assert groups == [live]
    assert all(actual is original for actual, original in zip(groups[0], live, strict=True))
    assert messages == before


def test_batched_tool_results_stay_with_their_call_in_original_order():
    batch = _exchange("first", "second")
    messages = [
        {"role": "user", "content": "task"},
        *batch,
        *_exchange("final"),
    ]
    before = deepcopy(messages)

    groups = _live_turn_groups(messages)

    assert groups == [batch]
    assert [call["id"] for call in groups[0][0]["tool_calls"]] == ["first", "second"]
    assert [result["tool_call_id"] for result in groups[0][1:]] == ["first", "second"]
    assert all(actual is original for actual, original in zip(groups[0], batch, strict=True))
    assert messages == before
