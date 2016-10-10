/* global ROWS, COLS, PLAYERS_START_POSITIONS, clone, MAP1, Tracer, _ */
let canvas = document.getElementById('app')
let ctx = canvas.getContext('2d')

const btnPeek = document.querySelector('#btn-peek')
const btnSpot = document.querySelector('#btn-spot')
const elActionPoints = document.querySelector('#action-points')

const gap = 30
const VISIBILITY_ANGLE = 90

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
  frustumLinesByPlayer: {0: [], 1: []}
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

  ctx.strokeStyle = 'gray'
  let playerIndex = state.currentTurn.playerIndex
  for (let line of renderCache.frustumLinesByPlayer[playerIndex]) {
    drawDebugLine(line)
  }

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

let onMouseMove = (x, y) => {
  if (!state.hoveredField) {
    state.hoveredField = {}
  }

  state.hoveredField.col = (x - x%gap)/gap
  state.hoveredField.row = (y - y%gap)/gap
}

let onMouseLeave = () => {
  state.hoveredField = null
}

let onMouseClick = (x, y) => {
  let col = (x - x%gap)/gap
  let row = (y - y%gap)/gap
  let block = { col, row }

  if (!isPointWall(col, row)) {
    if (!_(state.players).some(block)) {
      let player = state.players[state.currentTurn.playerIndex]
      player.col = col
      player.row = row

      updateTurnLogic()
    }
  }

  console.log(isPointNearWall(block))

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
  updateRayCast(evt.clientX, evt.clientY)
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

  // TODO possible algorithm:
  // 1. scan first direction, mark found free (non-block) rect as `current`
  // 2. go to a position next to the found point
  // 3. check if the next position is ray casted
  // 3.1. if yes, then go to 2.
  // 3.2. if no, then set closest raycasted point as `current`


  for (let angle = 0; angle < 360; angle += 1) {
    let ox = player.col*gap + gap/2
    let oy = player.row*gap + gap/2

    _castRayOnBlocks(ox, oy, angle)
  }
}

function updatePlayerVisibilityCone(playerIndex) {
  const player = state.players[state.currentTurn.playerIndex]
  let ox = player.col*gap + gap/2
  let oy = player.row*gap + gap/2

  let lines = renderCache.frustumLinesByPlayer[playerIndex]
  lines.length = 0

  for (let angle = 0; angle < 360; angle += 0.1) {
    let hit = castRayOnBlocks(ox, oy, angle)

    lines.push({
      ox, oy,
      tx: hit.point.x,
      ty: hit.point.y
    })
  }
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

const updateTurnLogic = () => {
  for (let playerIdx = 0; playerIdx < state.players.length; ++playerIdx) {
    let isNearWall = isPointNearWall(state.players[playerIdx])

    if (playerIdx === state.currentTurn.playerIndex) {
      btnPeek.disabled = !isNearWall
    }

    updatePlayerVisibilityCone(playerIdx)
  }

  elActionPoints.innerHTML = 'Action Points: ' + state.currentTurn.actionPoints
}

const isPointWall = (col, row) => {
  return col >= COLS || col < 0 || row < 0 || row >= ROWS
    && state.map[row][col] === true
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




updateTurnLogic()
redrawGame()

canvas.addEventListener('mousemove', evt => onMouseMove(evt.layerX, evt.layerY))
canvas.addEventListener('mouseleave', evt => onMouseLeave())
canvas.addEventListener('click', evt => onMouseClick(evt.layerX, evt.layerY))
document.addEventListener('keydown', evt => onKeyDown(evt))
