/* global _ */
const ROWS = 10, COLS = 30
const __map = [{"col":6,"row":2},{"col":6,"row":3},{"col":6,"row":4},{"col":6,"row":5},{"col":19,"row":6},{"col":19,"row":4},{"col":19,"row":5},{"col":22,"row":4},{"col":21,"row":4},{"col":20,"row":4},{"col":23,"row":4},{"col":14,"row":2},{"col":13,"row":3},{"col":13,"row":2},{"col":13,"row":4},{"col":13,"row":5},{"col":13,"row":6},{"col":16,"row":2},{"col":17,"row":2},{"col":17,"row":1},{"col":18,"row":1},{"col":20,"row":1},{"col":19,"row":1},{"col":21,"row":1},{"col":22,"row":1},{"col":23,"row":1},{"col":24,"row":1},{"col":27,"row":6},{"col":27,"row":5},{"col":27,"row":4},{"col":27,"row":7},{"col":22,"row":7},{"col":19,"row":9},{"col":16,"row":7},{"col":16,"row":8},{"col":4,"row":8},{"col":5,"row":8},{"col":7,"row":8},{"col":6,"row":8},{"col":10,"row":6},{"col":10,"row":8},{"col":10,"row":7},{"col":9,"row":3},{"col":10,"row":3},{"col":11,"row":3},{"col":13,"row":8},{"col":3,"row":2},{"col":3,"row":4},{"col":3,"row":3},{"col":8,"row":1},{"col":10,"row":1},{"col":11,"row":1},{"col":9,"row":1},{"col":2,"row":6},{"col":24,"row":8}]
const MAP1 = []
for (let rowIdx = 0; rowIdx < ROWS; ++rowIdx) {
  let row = []
  for (let colIdx = 0; colIdx < COLS; ++colIdx) {
    let isWall = _(__map).findIndex({row: rowIdx, col: colIdx}) >= 0
    row.push(isWall)
  }
  MAP1.push(row)
}

const PLAYERS_START_POSITIONS = [
  {row: 1, col: 1},
  {row: ROWS-2, col: COLS-2}
]