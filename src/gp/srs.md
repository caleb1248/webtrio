# The SRS+ rotation system

## Basics (SRS)

The SRS rotation can be summed up in these key points:

1. Each piece has a **center of rotation**. The square that make up the minos rotate around the center point.

   ![Z piece rotations](data:image/png;base64,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)

2. Sometimes the piece might collide with exising blocks when it rotates. In this case, the game will move the piece around until it fits in, using a specified set of movements ("kicks"). The first kick that works is used. The kick table is as follows:

> ## J, L, S, T, Z tetromino wall kick data
>
> | Transition | Test 1 | Test 2  | Test 3   | Test 4  | Test 5   |
> | ---------- | ------ | ------- | -------- | ------- | -------- |
> | 0→R        | (0, 0) | (-1, 0) | (-1, +1) | (0, -2) | (-1, -2) |
> | R→0        | (0, 0) | (+1, 0) | (+1, -1) | (0, +2) | (+1, +2) |
> | R→2        | (0, 0) | (+1, 0) | (+1, -1) | (0, +2) | (+1, +2) |
> | 2→R        | (0, 0) | (-1, 0) | (-1, +1) | (0, -2) | (-1, -2) |
> | 2→L        | (0, 0) | (+1, 0) | (+1, +1) | (0, -2) | (+1, -2) |
> | L→2        | (0, 0) | (-1, 0) | (-1, -1) | (0, +2) | (-1, +2) |
> | L→0        | (0, 0) | (-1, 0) | (-1, -1) | (0, +2) | (-1, +2) |
> | 0→L        | (0, 0) | (+1, 0) | (+1, +1) | (0, -2) | (+1, -2) |
>
> ## I tetromino wall kick data
>
> | Transition | Test 1 | Test 2  | Test 3  | Test 4   | Test 5   |
> | ---------- | ------ | ------- | ------- | -------- | -------- |
> | 0→R        | (0, 0) | (-2, 0) | (+1, 0) | (-2, -1) | (+1, +2) |
> | R→0        | (0, 0) | (+2, 0) | (-1, 0) | (+2, +1) | (-1, -2) |
> | R→2        | (0, 0) | (-1, 0) | (+2, 0) | (-1, +2) | (+2, -1) |
> | 2→R        | (0, 0) | (+1, 0) | (-2, 0) | (+1, -2) | (-2, +1) |
> | 2→L        | (0, 0) | (+2, 0) | (-1, 0) | (+2, +1) | (-1, -2) |
> | L→2        | (0, 0) | (-2, 0) | (+1, 0) | (-2, -1) | (+1, +2) |
> | L→0        | (0, 0) | (+1, 0) | (-2, 0) | (+1, -2) | (-2, +1) |
> | 0→L        | (0, 0) | (-1, 0) | (+2, 0) | (-1, +2) | (+2, -1) |
