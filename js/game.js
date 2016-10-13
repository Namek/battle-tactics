/* global ROWS, COLS, PLAYERS_START_POSITIONS, clone, MAP1, Tracer, astar, _ */
let canvas = document.getElementById('app')
let ctx = canvas.getContext('2d')

function $d(query) {
  return document.querySelector(query)
}

const btnPeek = $d('#btn-peek')
const btnSpot = $d('#btn-spot')
const btnRemoveLastAction = $d('#btn-remove-last-action')
const btnFinishTurn = $d('#btn-finish-turn')
const elActionPoints = $d('#action-points')
const elActionList = $d('#action-list')

const gap = 30
const VISIBILITY_ANGLE = 90
const CONE_LINES_PER_DEGREE = 10
const RAD_TO_DEG = 180 / Math.PI

const width = COLS * gap
const height = ROWS * gap
canvas.width = width
canvas.height = height

const PLAYER_RADIUS = gap/3

const BLOCK_COLOR = '#222'
const GRID_COLOR = '#777'
const PLAYER_COLOR = 'steelblue'
const ENEMY_COLOR = 'red'
const CURRENT_PLAYER_BACKGROUND = 'yellow'

const ACTION_POINTS = 5
const AP_MOVE = 1
const AP_PEEK = 2
const AP_SHOOT = 3


let state = {
  map: MAP1,//[by row][by col]
  hoveredField: null, //{col: number, row: number}
  playerIndex: 0,
  enemyPlayerIndex: 1,

  // [{row, col}]
  players: clone(PLAYERS_START_POSITIONS),

  currentTurn: {
    playerIndex: 0,
    actionPoints: ACTION_POINTS
  }
}

let renderCache = {
  visConeByPlayer: {
    0: {lines: [], point: {col: state.players[0].col, row: state.players[0].row}},
    1: {lines: [], point: {col: state.players[1].col, row: state.players[1].row}}
  },
  peekConeCacheByPlayer: {
    0: {lines: []},
    1: {lines: []}
  },
  availableFieldsByPlayer: {
    0: [/*{col, row}*/],
    1: []
  }
}

let tracer = new Tracer(state.map, COLS, ROWS, gap, gap)

let debugShapesOneFrame = {
  lines: [],
  rects: [],
  edges: [/*{dirX=-1/0/1, dirY=-1/0/1, col, row}*/],
  points: [/*{x, y}*/]
}

let debugShapesPersisting = {
  lines: [],
  rects: [],
  edges: [/*{dirX=-1/0/1, dirY=-1/0/1, col, row}*/],
  points: [/*{x, y}*/]
}


let drawBackground = () => {
  ctx.fillStyle = '#eee'
  ctx.fillRect(0,0,width,height)

  let playerIndex = state.currentTurn.playerIndex

  const availableFields = renderCache.availableFieldsByPlayer[playerIndex]
  ctx.fillStyle = 'rgba(188,188,188,1)'
  for (let field of availableFields) {
    let x = field.col*gap
    let y = field.row*gap
    ctx.fillRect(x, y, gap, gap)
  }

  ctx.strokeStyle = 'rgba(0,128,144,1)'
  let peekConeCache = renderCache.peekConeCacheByPlayer[playerIndex]
  for (let line of peekConeCache.lines) {
    drawDebugLine(line)
  }

  ctx.strokeStyle = 'rgba(112,128,144,1)'
  let frustumCache = renderCache.visConeByPlayer[playerIndex]
  for (let line of frustumCache.lines) {
    drawDebugLine(line)
  }

  ctx.fillStyle = 'yellow'
  drawDebugRect(frustumCache.point)

  if (!!state.hoveredField) {
    ctx.fillStyle = 'steelblue'
    let x = state.hoveredField.col*gap
    let y = state.hoveredField.row*gap
    ctx.fillRect(x, y, gap, gap)
  }
}

let drawGrid = () => {
  ctx.beginPath()
  ctx.strokeStyle = GRID_COLOR
  for (let y = gap; y < height; y+=gap) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)

    for (let x = gap; x < width; x+=gap) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
  }
  ctx.lineWidth = 1
  ctx.stroke()

  // mark available fields
  let playerIndex = state.currentTurn.playerIndex
  const availableFields = renderCache.availableFieldsByPlayer[playerIndex]
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 1
  for (let field of availableFields) {
    let x = field.col*gap
    let y = field.row*gap
    ctx.strokeRect(x, y, gap, gap)
  }
}

let drawBlocks = () => {
  for (let rowIdx = 0; rowIdx < ROWS; ++rowIdx) {
    for (let colIdx = 0; colIdx < COLS; ++colIdx) {
      if (state.map[rowIdx][colIdx]) {
        ctx.fillStyle = BLOCK_COLOR
        ctx.fillRect(colIdx*gap, rowIdx*gap, gap, gap)
      }
    }
  }
}

let drawPlayers = () => {
  for (let i = 0; i < state.players.length; ++i) {
    let player = state.players[i]
    let isEnemy = i === state.enemyPlayerIndex
    let centerX = player.col * gap + gap/2
    let centerY = player.row * gap + gap/2

    ctx.beginPath()

    if (state.currentTurn.playerIndex === i) {
      ctx.fillStyle = CURRENT_PLAYER_BACKGROUND
      ctx.fillRect(player.col*gap, player.row*gap, gap, gap)
    }

    ctx.fillStyle = isEnemy ? ENEMY_COLOR : PLAYER_COLOR
    ctx.arc(centerX, centerY, PLAYER_RADIUS, 0, 2*Math.PI, false)
    ctx.fill()
  }
}

function onHoveredFieldChanged(col, row) {
  let playerIndex = state.currentTurn.playerIndex
  let player = state.players[playerIndex]
  let isPlayer = col === player.col && row === player.row

  if (isPlayer || isFieldAccessibleToMove(playerIndex, col, row)) {
    updatePlayerVisibilityCone(state.playerIndex, col, row)
  }
}

let onMouseMove = (x, y) => {
  if (!state.hoveredField) {
    state.hoveredField = {}
  }

  let col = (x - x%gap)/gap
  let row = (y - y%gap)/gap

  if (state.hoveredField.col !== col || state.hoveredField.row !== row) {
    onHoveredFieldChanged(col, row)
  }

  state.hoveredField.col = col
  state.hoveredField.row = row
}

let onMouseLeave = () => {
  state.hoveredField = null
  updatePlayerVisibilityCone(state.playerIndex)
}

let onMouseClick = (x, y) => {
  let col = (x - x%gap)/gap
  let row = (y - y%gap)/gap
  let playerIndex = state.currentTurn.playerIndex

  if (isFieldAccessibleToMove(playerIndex, col, row)) {
    movePlayerIfPossible(playerIndex, col, row)
    updateTurnLogicAndVisuals()
  }

/*
  let idx = _(blocks).findIndex(block)
  if (idx < 0) {
    blocks.push(block)
  }
  else {
    blocks.splice(idx, 1)
  }

  console.log(JSON.stringify(blocks))*/
}

function onKeyDown(evt) {
  //updateRayCast(evt.clientX, evt.clientY)
}

function onPeekHovered() {
  let playerIndex = state.currentTurn.playerIndex
  let player = state.players[playerIndex]

  updatePlayerPeekCone(playerIndex)
}

function onPeekLeave() {
  let playerIndex = state.currentTurn.playerIndex
  removePlayerPeekCone(playerIndex)
}

function onPeek() {
  // TODO spend action points
}

function onRemoveLastAction() {
  // TODO
}

function onFinishTurn() {
  // TODO
}


function drawDebugLine(line) {
  ctx.beginPath()
  ctx.moveTo(line.ox, line.oy)
  ctx.lineTo(line.tx, line.ty)
  ctx.stroke()
}

function drawDebugRect(rect) {
  ctx.beginPath()
  ctx.fillRect(rect.col*gap+gap/4, rect.row*gap+gap/4, gap/2, gap/2)
}

function drawDebugPoint(point) {
  ctx.beginPath()
  ctx.arc(point.x, point.y, 4, 0, 2*Math.PI, false)
  ctx.fill()
}

let redrawGame = () => {
  ctx.clearRect(0, 0, width, height)
  drawBackground()
  drawGrid()
  drawBlocks()

  drawPlayers()

  ctx.fillStyle = '#f0f'
  for (let rect of debugShapesOneFrame.rects) {
    drawDebugRect(rect)
  }
  for (let rect of debugShapesPersisting.rects) {
    drawDebugRect(rect)
  }
  debugShapesOneFrame.rects.length = 0

  ctx.strokeStyle = '#f0f'
  for (let line of debugShapesOneFrame.lines) {
    drawDebugLine(line)
  }
  for (let line of debugShapesPersisting.lines) {
    drawDebugLine(line)
  }
  debugShapesOneFrame.lines.length = 0

  ctx.fillStyle = 'red'
  for (let point of debugShapesPersisting.points) {
    drawDebugPoint(point)
  }
  for (let point of debugShapesOneFrame.points) {
    drawDebugPoint(point)
  }
  debugShapesOneFrame.length = 0

  window.requestAnimationFrame(redrawGame)
}

const updateRayCast = (targetX, targetY) => {
  const player = state.players[state.currentTurn.playerIndex]

  let line = {
    ox: player.col*gap + gap/2,
    oy: player.row*gap + gap/2,
    tx: targetX,
    ty: targetY
  }
  debugShapesPersisting.lines.push(line)

  for (let angle = 0, diff = 1.0/CONE_LINES_PER_DEGREE; angle < 360; angle += diff) {
    let ox = player.col*gap + gap/2
    let oy = player.row*gap + gap/2

    _castRayOnBlocks(ox, oy, angle)
  }
}

function updatePlayerVisibilityCone(playerIndex, col = undefined, row = undefined) {
  const player = state.players[playerIndex]
  let frustumCache = renderCache.visConeByPlayer[playerIndex]

  col = col == undefined ? player.col : col
  row = row == undefined ? player.row : row

  updateVisibilityCone(col, row, frustumCache)
}

function updateVisibilityCone(col, row, frustumCache) {
  let ox = col*gap + gap/2
  let oy = row*gap + gap/2

  frustumCache.lines.length = 0
  for (let angle = 0, diff = 1.0/CONE_LINES_PER_DEGREE; angle < 360; angle += diff) {
    let hit = castRayOnBlocks(ox, oy, angle)

    frustumCache.lines.push({
      ox, oy,
      tx: hit.point.x,
      ty: hit.point.y
    })
  }

  frustumCache.point.col = col
  frustumCache.point.row = row
}

function updatePlayerAvailableFields(playerIndex) {
  const player = state.players[playerIndex]
  const availableFields = renderCache.availableFieldsByPlayer[playerIndex]
  const maxMoves = Math.floor(state.currentTurn.actionPoints / AP_MOVE)

  const left = Math.max(0, player.col - maxMoves)
  const right = Math.min(COLS - 1, player.col + maxMoves)
  const top = Math.max(0, player.row - maxMoves)
  const bottom = Math.min(ROWS - 1, player.row + maxMoves)

  availableFields.length = 0

  for (let row = top; row <= bottom; ++row) {
    for (let col = left; col <= right; ++col) {
      let path = findPath(player.col, player.row, col, row)
      let neededActionPoints = AP_MOVE * path.length

      if (state.currentTurn.actionPoints >= neededActionPoints) {
        availableFields.push({ col, row })
      }
    }
  }
}

function updatePlayerPeekCone(playerIndex) {
  const player = state.players[playerIndex]
  let peekConeCache = renderCache.peekConeCacheByPlayer[playerIndex]
  return updatePeekCone(peekConeCache, player.col, player.row)
}

function updatePeekCone(peekConeCache, viewerCol, viewerRow) {
  peekConeCache.length = 0

  let peekCells = findPeekCells(viewerCol, viewerRow)

  for (let cell of peekCells) {
    const peekDirX = cell.dirX
    const peekDirY = cell.dirY

    let peekCellDirX = cell.col - viewerCol
    let peekCellDirY = cell.row - viewerRow

    let shouldBeginWithMidVec = peekDirY !== 0
      ? peekDirY !== peekCellDirX
      : peekDirX === peekCellDirY

    // get angle between midVec or peekDir and vec=[1,0]
    // where midVec = normalize(peekDir + peekCellDir)
    let angleStart = shouldBeginWithMidVec
      ? -Math.atan2((peekDirY + peekCellDirY) / 2, (peekDirX + peekCellDirX) / 2)
      : -Math.atan2(peekDirY, peekDirX)

    angleStart *= RAD_TO_DEG

    let iterations = 45 * CONE_LINES_PER_DEGREE
    let angleDiff = 1.0 / CONE_LINES_PER_DEGREE

    let ox = cell.col*gap + gap/2 - (peekDirY !== 0 ? gap / 2 * (cell.col - viewerCol) : 0)
    let oy = cell.row*gap + gap/2 - (peekDirX !== 0 ? gap/2 * (cell.row - viewerRow) : 0)

    for (let angle = angleStart, i = 0; i < iterations; angle += angleDiff, ++i) {
      let hit = castRayOnBlocks(ox, oy, angle)

      peekConeCache.lines.push({
        ox, oy,
        tx: hit.point.x,
        ty: hit.point.y
      })
    }
  }
}

function removePlayerPeekCone(playerIndex) {
  let peekConeCache = renderCache.peekConeCacheByPlayer[playerIndex]
  removePeekCone(peekConeCache)
}

function removePeekCone(peekConeCache) {
  peekConeCache.lines.length = 0
}

function _castRayOnBlocks(ox, oy, angle) {
  let res = castRayOnBlocks(ox, oy, angle)

  if (res.didHitWall) {
    debugShapesPersisting.points.push(res.point)
  }

  debugShapesPersisting.lines.push({
    ox, oy,
    tx: res.point.x, ty: res.point.y
  })
}

function castRayOnBlocks(ox, oy, angle) {
  // rotate vector [1, 0]
  let rotX = Math.cos(angle * Math.PI/180)
  let rotY = -Math.sin(angle * Math.PI/180)

  return tracer.setupXY(ox, oy, rotX, rotY).getHit()
}

const updateTurnLogicAndVisuals = () => {
  for (let playerIdx = 0; playerIdx < state.players.length; ++playerIdx) {
    if (playerIdx === state.currentTurn.playerIndex) {
      btnPeek.disabled = !canPlayerPeek(playerIdx)
    }

    updatePlayerVisibilityCone(playerIdx)
    updatePlayerAvailableFields(playerIdx)
  }

  elActionPoints.innerHTML = 'Action Points: ' + state.currentTurn.actionPoints
}

function movePlayerIfPossible(playerIndex, col, row) {
  let moveConds = calcPlayerMoveConditions(playerIndex, col, row)

  if (!moveConds.canMoveTo) {
    return false
  }

  let player = state.players[playerIndex]
  player.col = col
  player.row = row

  state.currentTurn.actionPoints -= moveConds.neededActionPoints
}

function isStandableField(col, row) {
  return !isPointWall(col, row) && !_(state.players).some({ col, row })
}

function calcPlayerMoveConditions(playerIndex, col, row) {
  let res = {
    isStandableField: isStandableField(col, row),
    path: null,
    neededActionPoints: 0,
    canMoveTo: false
  }

  if (res.isStandableField) {
    let player = state.players[playerIndex]
    res.path = findPath(player.col, player.row, col, row)
    res.neededActionPoints = AP_MOVE * res.path.length
    res.canMoveTo = state.currentTurn.actionPoints >= res.neededActionPoints
  }

  return res
}

function isFieldAccessibleToMove(playerIndex, col, row) {
  return calcPlayerMoveConditions(playerIndex, col, row).canMoveTo
}

function canPlayerPeek(playerIndex) {
  let player = state.players[playerIndex]
  let walls = findNearPeekableWalls(player.col, player.row)

  return walls.length > 0
}

const isPointWall = (col, row) => {
  return col >= COLS || col < 0 || row < 0 || row >= ROWS
    || state.map[row][col] === true
}

function findNearPeekableWalls(col, row) {
  const checks = [
    {col: col-1, row},
    {col: col+1, row},
    {col, row: row-1},
    {col, row: row+1}
  ]

  return checks.filter(c => {
    if (c.col < 0 || c.row < 0 || c.col >= COLS || c.row >= ROWS)
      return false

    return isPointWall(c.col, c.row) && isWallPeekable(col, row, c.col, c.row)
  })
}

// a peekable wall is a wall which can be be used to peek behind it.
//
// assuming that:
// 1. given cell has wall
// 2. viewer point is a neighbour to it
function isWallPeekable(viewerCol, viewerRow, cellCol, cellRow) {
  let dirX = cellCol - viewerCol
  let dirY = cellRow - viewerRow

  console.assert(Math.abs(dirX)*2 + Math.abs(dirY)*2 === 2 , "peekable cell should adjoint to viewer")

  if (dirY !== 0) {
    if (!isPointWall(cellCol+1, cellRow))
      return true

    if (!isPointWall(cellCol-1, cellRow))
      return true
  }
  else if (dirX !== 0) {
    if (!isPointWall(cellCol, cellRow-1))
      return true

    if (!isPointWall(cellCol, cellRow+1))
      return true
  }

  return false
}

// assuming that:
// 1. given cell is is peekable
//
// @return cells from which rays are to be casted to broaden the visibility cone during Peek
function findPeekCells(viewerCol, viewerRow) {
  let peekableWalls = findNearPeekableWalls(viewerCol, viewerRow)
  let peekCells = []

  for (let w of peekableWalls) {
    let dirX = w.col - viewerCol
    let dirY = w.row - viewerRow

    console.assert(Math.abs(dirX) + Math.abs(dirY) === 1)

    if (dirY === 0) { // is the wall to the right or left?
      if (!isPointWall(w.col, w.row-1)) {
        peekCells.push({
          col: viewerCol, row: viewerRow-1,
          dirX, dirY
        })
      }

      if (!isPointWall(w.col, w.row+1)) {
        peekCells.push({
          col: viewerCol, row: viewerRow+1,
          dirX, dirY
        })
      }
    }
    else { // is the wall above or under viewer?
      if (!isPointWall(w.col-1, w.row)) {
        peekCells.push({
          col: viewerCol-1, row: viewerRow,
          dirX, dirY
        })
      }

      if (!isPointWall(w.col+1, w.row)) {
        peekCells.push({
          col: viewerCol+1, row: viewerRow,
          dirX, dirY
        })
      }
    }
  }

  return peekCells
}

// if at the point itself is a wall then return false
const isPointNearWall = ({col, row}) => {
  if (isPointWall(col, row))
    return false

  if (col > 0 && isPointWall(col-1, row))
    return true
  if (col < COLS-1 && isPointWall(col+1, row))
    return true
  if (row > 0 && isPointWall(col, row-1))
    return true
  if (row < ROWS-1 && isPointWall(col, row+1))
    return true

  return false
}

// @return [{x, y}]
function findPath(colFrom, rowFrom, colTo, rowTo) {
  return astar.search(clone(state.map), colFrom, rowFrom, colTo, rowTo)
}


updateTurnLogicAndVisuals()
redrawGame()

;(() => {
  function $l(el, eventType, listener) {
    el.addEventListener(eventType, listener)
  }

  $l(canvas, 'mousemove', evt => onMouseMove(evt.layerX, evt.layerY))
  $l(canvas, 'mouseleave', evt => onMouseLeave())
  $l(canvas, 'click', evt => onMouseClick(evt.layerX, evt.layerY))
  $l(document, 'keydown', evt => onKeyDown(evt))

  $l(btnPeek, 'mouseenter', evt => onPeekHovered())
  $l(btnPeek, 'mouseleave', evt => onPeekLeave())
  $l(btnPeek, 'click', evt => onPeek())
  $l(btnRemoveLastAction, 'click', evt => onRemoveLastAction())
  $l(btnFinishTurn, 'click', evt => onFinishTurn())
})()