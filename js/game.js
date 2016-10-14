/* global ROWS, COLS, PLAYERS_START_POSITIONS, clone, MAP1, Tracer, astar, _ */
let canvas = document.getElementById('app')
let ctx = canvas.getContext('2d')

function $d(query) {
  return document.querySelector(query)
}

const btnRemoveLastAction = $d('#btn-remove-last-action')
const btnWait = $d('#btn-wait')
const btnPeek = $d('#btn-peek')
const btnFire = $d('#btn-fire')
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

const MAX_ACTION_POINTS = 5
const AP_WAIT = 1
const AP_MOVE = 1
const AP_PEEK = 2
const AP_SHOOT = 3

btnWait.title = `cost: ${AP_WAIT} AP`
btnPeek.title = `cost: ${AP_PEEK} AP`
btnFire.title = `cost: ${AP_SHOOT} AP`

const ACTION_MOVE = 'move'
const ACTION_PEEK = 'peek'
const ACTION_SHOOT = 'shoot'
const ACTION_WAIT = 'wait'
const ACTION_IDLE = 'idle' // ACTION_WAIT is converted to this one 

const actionToCost = {
  [ACTION_WAIT]: AP_WAIT,
  [ACTION_MOVE]: AP_MOVE,
  [ACTION_PEEK]: AP_PEEK,
  [ACTION_SHOOT]: AP_SHOOT
}

function calcAvailableActionPoints(playerIndex) {
  return Math.max(0, MAX_ACTION_POINTS - calcSpentActionPoints(playerIndex))
}

function calcSpentActionPoints(playerIndex) {
  return state.currentTurnByPlayer[playerIndex].actions
    .map(action => actionToCost[action.type])
    .reduce((total, points) => total + points, 0)
}


let state = {
  map: MAP1,//[by row][by col]
  hoveredField: null, //{col: number, row: number}
  playerIndex: 0,
  enemyPlayerIndex: 1,

  // [{row, col}]
  players: PLAYERS_START_POSITIONS.map(p => Object.assign({ alive: true }, p)),

  activePlayerIndex: 0,

  currentTurnByPlayer: {
    0: {
      actions: [/* { type: ACTION_*, col?, row? } */]
    },
    1: {
      actions: []
    }
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

  let playerIndex = state.activePlayerIndex

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
  let playerIndex = state.activePlayerIndex
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

    if (state.activePlayerIndex === i) {
      ctx.fillStyle = CURRENT_PLAYER_BACKGROUND
      ctx.fillRect(player.col*gap, player.row*gap, gap, gap)
    }

    ctx.fillStyle = isEnemy ? ENEMY_COLOR : PLAYER_COLOR
    ctx.arc(centerX, centerY, PLAYER_RADIUS, 0, 2*Math.PI, false)
    ctx.fill()
  }
}

function onHoveredFieldChanged(col, row) {
  let playerIndex = state.activePlayerIndex
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
  let playerIndex = state.activePlayerIndex

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

function onRemoveLastAction() {
  let playerIndex = state.activePlayerIndex
  let actions = state.currentTurnByPlayer[playerIndex].actions
  let player = state.players[playerIndex]

  if (actions.length > 0) {
    let action = actions.pop()
    if (action.type === ACTION_MOVE) {
      player.col = action.prevCol
      player.row = action.prevRow
    }
  }

  updateTurnLogicAndVisuals()
}

function onWait() {
  let currentTurn = state.currentTurnByPlayer[state.activePlayerIndex]
  currentTurn.actions.push({
    type: ACTION_WAIT
  })
  updateTurnLogicAndVisuals()
}

function onPeekHovered() {
  let playerIndex = state.activePlayerIndex
  let player = state.players[playerIndex]

  updatePlayerPeekCone(playerIndex)
}

function onPeekLeave() {
  let playerIndex = state.activePlayerIndex
  removePlayerPeekCone(playerIndex)
}

function onPeek() {
  let currentTurn = state.currentTurnByPlayer[state.activePlayerIndex]
  currentTurn.actions.push({
    type: ACTION_PEEK
  })
  updateTurnLogicAndVisuals()
}

function onFire() {
  let currentTurn = state.currentTurnByPlayer[state.activePlayerIndex]
  currentTurn.actions.push({
    type: ACTION_SHOOT
  })
  updateTurnLogicAndVisuals()
}

function onFinishTurn() {
  let newPlayerIndex = (state.activePlayerIndex+1) % 2

  if (newPlayerIndex === 0) {
    let {events, deadPlayers, alivePlayers} = simulateTurn()

    // TODO animate events (move, firing, peeking)
    let isGameOver = alivePlayers.length <= 1

    if (!isGameOver) {
      // give back all points to the alive players
      for (let pi of alivePlayers) {
        state.currentTurnByPlayer[pi].actions.length = 0
      }
    }
    else {
      window.alert(`Player ${alivePlayers[0]} has won!`)

      // TODO reset the game
    }
  }

  state.activePlayerIndex = newPlayerIndex
  updateTurnLogicAndVisuals()
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
  const player = state.players[state.activePlayerIndex]

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
  const playerTurn = state.currentTurnByPlayer[playerIndex]
  const availableFields = renderCache.availableFieldsByPlayer[playerIndex]
  const availableActionPoints = calcAvailableActionPoints(playerIndex)
  const maxMoves = Math.floor(availableActionPoints / AP_MOVE)

  const left = Math.max(0, player.col - maxMoves)
  const right = Math.min(COLS - 1, player.col + maxMoves)
  const top = Math.max(0, player.row - maxMoves)
  const bottom = Math.min(ROWS - 1, player.row + maxMoves)

  availableFields.length = 0

  for (let row = top; row <= bottom; ++row) {
    for (let col = left; col <= right; ++col) {
      let path = findPath(player.col, player.row, col, row)
      let neededActionPoints = AP_MOVE * path.length

      if (availableActionPoints >= neededActionPoints) {
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
  peekConeCache.lines.length = 0

  let peekCells = findPeekCells(viewerCol, viewerRow)

  for (let cell of peekCells) {
    const params = calcPeekPointParams(viewerCol, viewerRow, cell)

    let shouldBeginWithMidVec = params.peekDirY !== 0
      ? params.peekDirY !== params.peekCellDirX
      : params.peekDirX === params.peekCellDirY

    let angleStart = shouldBeginWithMidVec ? params.midVecAngle : params.peekDirAngle
    angleStart *= RAD_TO_DEG

    let iterations = 45 * CONE_LINES_PER_DEGREE
    let angleDiff = 1.0 / CONE_LINES_PER_DEGREE

    const ox = params.ox, oy = params.oy

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

function calcPeekPointParams(viewerCol, viewerRow, peekCell) {
  const peekDirX = peekCell.dirX
  const peekDirY = peekCell.dirY

  let peekCellDirX = peekCell.col - viewerCol
  let peekCellDirY = peekCell.row - viewerRow

  // get angle between midVec / peekDir and vec=[1,0]
  // where midVec = normalize(peekDir + peekCellDir)
  let midVecAngle = -Math.atan2((peekDirY + peekCellDirY) / 2, (peekDirX + peekCellDirX) / 2)
  let peekDirAngle = -Math.atan2(peekDirY, peekDirX)

  let ox = peekCell.col*gap + gap/2 - (peekDirY !== 0 ? gap / 2 * (peekCell.col - viewerCol) : 0)
  let oy = peekCell.row*gap + gap/2 - (peekDirX !== 0 ? gap/2 * (peekCell.row - viewerRow) : 0)

  return {
    peekDirX, peekDirY,
    peekCellDirX, peekCellDirY,
    midVecAngle, peekDirAngle,
    ox, oy
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

function pointsToNormVector(x1, y1, x2, y2) {
  let dirX = x2 - x1
  let dirY = y2 - y1
  let len = dirX*dirX + dirY*dirY
  dirX /= len
  dirY /= len

  return { dirX, dirY, len }
}

function vectorToAngle(dirX, dirY) {
  return -Math.atan2(dirY, dirX) * RAD_TO_DEG
}

function calcDirectedAngleBetweenPoints(x1, y1, x2, y2) {
  let vec = pointsToNormVector(x1, y1, x2, y2)
  return vectorToAngle(vec.dirX, vec.dirY)
}

const updateTurnLogicAndVisuals = () => {
  for (let playerIdx = 0; playerIdx < state.players.length; ++playerIdx) {
    if (playerIdx === state.activePlayerIndex) {
      btnPeek.disabled = !canPlayerPeek(playerIdx)
    }

    updatePlayerVisibilityCone(playerIdx)
    updatePlayerPeekCone(playerIdx)
    updatePlayerAvailableFields(playerIdx)
  }

  let activePlayerTurn = state.currentTurnByPlayer[state.activePlayerIndex]
  elActionPoints.innerHTML = calcAvailableActionPoints(state.activePlayerIndex)

  let spentActionPoints = calcSpentActionPoints(state.activePlayerIndex)
  let timeline = actionsToTimeline(activePlayerTurn.actions)
  let timelineStr = ''
  for (let ti = 0; ti < timeline.length; ++ti) {
    timelineStr += spentActionPoints === ti ? '&#8677;' : ' '
    timelineStr += `${ti+1}: `
    timelineStr += ti < timeline.length ? timeline[ti].type : '*'
    timelineStr += '\r\n'
  }
  elActionList.innerHTML = timelineStr
}

function simulateTurn() {
  const allPlayers = state.players
  const playersCount = allPlayers.length

  let alivePlayers = _.range(playersCount)
    .filter(pi => allPlayers[pi].alive)

  let deadPlayers = _.range(playersCount)
    .filter(pi => !allPlayers[pi].alive)

  let timelineByPlayer = alivePlayers
    .map(playerIndex => playerActionsToTimeline(playerIndex))

  let events = []
  let step = 0

  // TODO Note: if player is shooting when enemy is shooting at him too, then both should die

  do {
    let stepEvents = []

    // 1. mark who is peeking this round and find out who sees who before any movement
    let currentPeekers = alivePlayers
      .filter(pi => timelineByPlayer[pi][step].type === ACTION_PEEK)

    let whoSeesWho = {}

    for (let pi of alivePlayers) {
      whoSeesWho[pi] = spotEnemies(pi, alivePlayers)
    }

    // 2. peek over corner for other players and mark seen enemies
    for (let pi of currentPeekers) {
      stepEvents.push({
        type: 'ENEMY_SPOTTED',
        playerIndex: pi,
        enemies: whoSeesWho[pi]
      })
    }

    // 3. simulate firing
    for (let pi of alivePlayers) {
      let player = allPlayers[pi]
      let timeline = timelineByPlayer[pi]
      let action = timeline[step]

      if (action.type === ACTION_SHOOT) {
        let visibleEnemies = whoSeesWho[pi]

        if (visibleEnemies.length > 0) {
          let enemy = _(visibleEnemies).minBy('distance')

          stepEvents.push({
            type: 'TOOK_DOWN_ENEMY',
            enemy
          })

          deadPlayers.push(enemy.playerIndex)
          alivePlayers = alivePlayers.filter(pi => pi !== enemy.playerIndex)
        }
      }
    }

    // 4. simulate movement
    for (let pi of alivePlayers) {
      let player = allPlayers[pi]
      let timeline = timelineByPlayer[pi]
      let action = timeline[step]

      if (action.type === ACTION_MOVE) {
        stepEvents.push({
          type: 'PLAYER_MOVED',
          colFrom: player.col,
          rowFrom: player.row,
          colTo: action.col,
          rowTo: action.row
        })

        player.col = action.col
        player.row = action.row
      }
    }

    events.push(stepEvents)
    stepEvents = []

    // 5. peek/shoot again after some enemies have moved
    for (let pi of alivePlayers) {
      let player = allPlayers[pi]
      let timeline = timelineByPlayer[pi]
      let action = timeline[step]

      if (action.type === ACTION_SHOOT) {
        let visibleEnemies = whoSeesWho[pi]
          .filter(pi => alivePlayers.indexOf(pi) >= 0)

        if (visibleEnemies.length > 0) {
          let enemy = _(visibleEnemies).minBy('distance')

          stepEvents.push({
            type: 'TOOK_DOWN_ENEMY',
            enemy
          })

          deadPlayers.push(enemy.playerIndex)
          alivePlayers = alivePlayers.filter(pi => pi !== enemy.playerIndex)
        }
      }
    }

    events.push(stepEvents)
    ++step
  } while (step < MAX_ACTION_POINTS)

  return { events, deadPlayers, alivePlayers }
}

function spotEnemies(playerIndex, alivePlayers) {
  const allPlayers = state.players
  let player = allPlayers[playerIndex]
  let ox = player.col*gap + gap/2
  let oy = player.row*gap + gap/2

  let spotted = []

  for (let epi of alivePlayers) {
    if (epi === playerIndex)
      continue

    let enemy = allPlayers[epi]
    let eox = enemy.col*gap + gap/2
    let eoy = enemy.row*gap + gap/2

    // 1. try spotting enemies standing on the center of field
    let enemyDir = pointsToNormVector(ox, oy, eox, eoy)
    let hit = castRayOnBlocks(ox, oy, vectorToAngle(enemyDir))
    let hitDir = pointsToNormVector(ox, oy, hit.point.x, hit.point.y)

    let distance = enemyDir.len
    let wasEnemySpotted = hitDir.len > distance

    if (!wasEnemySpotted) {
      // 2. take a chance behind the corner
      let peekCells = findPeekCells(player.col, player.row)
      for (let cell of peekCells) {
        const peekParams = calcPeekPointParams(player.col, player.row, cell)
        let ox = peekParams.ox
        let oy = peekParams.oy

        enemyDir = pointsToNormVector(ox, oy, eox, eoy)
        hit = castRayOnBlocks(ox, oy, vectorToAngle(enemyDir))
        hitDir = pointsToNormVector(ox, oy, hit.point.x, hit.point.y)

        distance = enemyDir.len
        wasEnemySpotted = hitDir.len > distance
      }
    }

    if (wasEnemySpotted) {
      spotted.push({
        playerIndex: epi,
        distance,
        col: enemy.col,
        row: enemy.col
      })
    }
  }

  return spotted
}

function playerActionsToTimeline(playerIndex) {
  return actionsToTimeline(state.currentTurnByPlayer[playerIndex].actions)
}

function actionsToTimeline(actions) {
  let timeline = clone(actions)

  for (let i = timeline.length; i < MAX_ACTION_POINTS; ++i) {
    let prevAction = i > 0 ? timeline[i-1].type : ACTION_IDLE
    let newAction = prevAction === ACTION_PEEK || prevAction === ACTION_SHOOT ? prevAction : ACTION_IDLE
    timeline[i] = {
      type: newAction
    }
  }

  return timeline
}

function movePlayerIfPossible(playerIndex, col, row) {
  let moveConds = calcPlayerMoveConditions(playerIndex, col, row)

  if (!moveConds.canMoveTo) {
    return false
  }

  let player = state.players[playerIndex]
  let playerTurn = state.currentTurnByPlayer[playerIndex]

  let prevCol = player.col
  let prevRow = player.row

  for (let field of moveConds.path) {
    playerTurn.actions.push({
      type: ACTION_MOVE,
      col: field.x,
      row: field.y,
      prevCol,
      prevRow
    })

    prevCol = field.x
    prevRow = field.y
  }

  player.col = col
  player.row = row
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
    let activePlayerTurn = state.currentTurnByPlayer[playerIndex]
    let availableActionPoints = calcAvailableActionPoints(playerIndex)
    res.path = findPath(player.col, player.row, col, row)
    res.neededActionPoints = AP_MOVE * res.path.length
    res.canMoveTo = availableActionPoints >= res.neededActionPoints
  }

  return res
}

function isFieldAccessibleToMove(playerIndex, col, row) {
  return calcPlayerMoveConditions(playerIndex, col, row).canMoveTo
}

function canPlayerPeek(playerIndex) {
  let player = state.players[playerIndex]
  let walls = findNearPeekableWalls(player.col, player.row)

  if (walls.length === 0)
    return false

  return calcAvailableActionPoints(playerIndex) >= AP_PEEK
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

  $l(btnRemoveLastAction, 'click', evt => onRemoveLastAction())
  $l(btnWait, 'click', evt => onWait())
  $l(btnPeek, 'mouseenter', evt => onPeekHovered())
  $l(btnPeek, 'mouseleave', evt => onPeekLeave())
  $l(btnPeek, 'click', evt => onPeek())
  $l(btnFire, 'click', evt => onFire())
  $l(btnFinishTurn, 'click', evt => onFinishTurn())
})()