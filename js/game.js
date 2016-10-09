/* global ROWS, COLS, PLAYERS_START_POSITIONS, clone, MAP1, Tracer, _ */
let canvas = document.getElementById('app')
let ctx = canvas.getContext('2d')

const btnPeek = document.querySelector('#btn-peek')
const btnSpot = document.querySelector('#btn-spot')

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



let state = {
  map: MAP1,//[by row][by col]
  hoveredField: null, //{col: number, row: number}
  playerIndex: 0,
  enemyPlayerIndex: 1,

  // [{row, col, dirX, dirY}]
  players: clone(PLAYERS_START_POSITIONS),

  currentTurn: {
    playerIndex: 0
  }
}

let tracer = new Tracer(state.map, COLS, ROWS, gap, gap)

let debugLinesToRender = []
let debugRects = []
let debugEdges = [/*{dirX=-1/0/1, dirY=-1/0/1, col, row}*/]
let debugPoints = [/*{x, y}*/]


let drawBackground = () => {
  ctx.fillStyle = '#eee'
  ctx.fillRect(0,0,width,height)

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

    // TODO draw visibility frustum


    // draw possible move directions
    if (state.currentTurn.playerIndex === i) {
      // TODO
    }
  }
}

let onMouseMove = (x, y) => {
  if (!state.hoveredField) {
    state.hoveredField = {}
  }

  state.hoveredField.col = (x - x%gap)/gap
  state.hoveredField.row = (y - y%gap)/gap

  updateRayCast(x, y)
}

let onMouseLeave = () => {
  state.hoveredField = null
}

let onMouseClick = (x, y) => {
  let block = {
    col: (x - x%gap)/gap,
    row: (y - y%gap)/gap
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

let redrawGame = () => {
  ctx.clearRect(0, 0, width, height)
  drawBackground()
  drawGrid()
  drawBlocks()

  ctx.fillStyle = '#f0f'
  for (let rect of debugRects) {
    ctx.beginPath()
    ctx.fillRect(rect.col*gap+gap/4, rect.row*gap+gap/4, gap/2, gap/2)
  }

  drawPlayers()

  ctx.strokeStyle = '#f0f'
  for (let line of debugLinesToRender) {
    ctx.beginPath()
    ctx.moveTo(line.ox, line.oy)
    ctx.lineTo(line.tx, line.ty)
    ctx.stroke()
  }

  ctx.strokeStyle = 'red'
  ctx.lineWidth = 5
  for (let edge of debugEdges) {
    ctx.beginPath()

    let ox = edge.col*gap + gap
    let oy = edge.row*gap
    let tx = ox
    let ty = oy + gap

    if (edge.angleTo90 === 1) {
      ox = edge.col*gap
      tx = ox + gap
      ty = oy
    }
    else if (edge.angleTo90 === 2) {
      ox = edge.col*gap
      tx = ox
    }
    else if (edge.angleTo90 === 3) {
      ox = edge.col*gap
      tx = ox + gap
      oy += gap
    }



    // let cx = edge.col*gap + gap/2
    // let cy = edge.row*gap + gap/2

    // let isVert = edge.dirX !== 0

    // let ox = edge.col*gap
    // let oy = edge.row*gap
    // let tx = ox+gap
    // let ty = oy

    // if (isVert) {
    //   ox += gap
    //   ty += gap
    // }
    // else if (!isVert && edge.dirY > 0) {
    //   oy += gap
    //   ty += gap
    // }

    ctx.moveTo(ox, oy)
    ctx.lineTo(tx, ty)
    ctx.stroke()
  }

  for (let point of debugPoints) {
    ctx.beginPath()
    ctx.fillStyle = 'red'
    ctx.arc(point.x, point.y, 4, 0, 2*Math.PI, false)
    ctx.fill()
    ctx.stroke()
  }

  window.requestAnimationFrame(redrawGame)
}

const updateRayCast = (targetX, targetY) => {
  const player = state.players[state.currentTurn.playerIndex]

  debugLinesToRender.length = 0
  debugRects.length = 0
  debugEdges.length = 0

  let line = {
    ox: player.col*gap + gap/2,
    oy: player.row*gap + gap/2,
    tx: targetX,
    ty: targetY
  }
  debugLinesToRender.push(line)

  // 1. scan first direction, mark found free (non-block) rect as `current`
  // 2. go to a position next to the found point
  // 3. check if the next position is ray casted
  // 3.1. if yes, then go to 2.
  // 3.2. if no, then set closest raycasted point as `current`


  _castRayOnBlocks(player, 0)
  _castRayOnBlocks(player, 90)
  _castRayOnBlocks(player, -90)
  _castRayOnBlocks(player, -180)


  for (let angle = 0; angle < 360; angle += 1) {
    _castRayOnBlocks(player, angle)
  }
}

function _castRayOnBlocks(from, angle) {
  let res = castRayOnBlocks(from, angle)

  if (res.didHit) {
    debugPoints.push(res.point)
  }
}

function castRayOnBlocks(from, angle) {
  let {col, row} = from

  let ox = col*gap + gap/2
  let oy = row*gap + gap/2

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
  }
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
