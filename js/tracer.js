const HORZ = 1
const VERT = 2

const LEFT = -1
const RIGHT = 1
const UP = -1
const DOWN = 1
const NONE = 0

const WALL = true
const NO_WALL = false

const SQRT2 = Math.sqrt(2)

class Tracer {
	constructor(walls, colsCount, rowsCount, tileWidth, tileHeight) {
		this.walls = walls
		this.colsCount = colsCount
		this.rowsCount = rowsCount
		this.tileWidth = tileWidth
		this.tileHeight = tileHeight

		this.originPoint = {x: 0, y: 0}
		this.direction = {x: 0, y: 0}
		this._moves = [0, 0]
	}
	
	setup(originPoint, direction) {
		this.originPoint = originPoint
		this.direction = direction
		return this
	}
	
	getHit() {
    let hit = {
			point: {x: 0, y: 0},
			didHit: false
		}
		this.hit(hit)
    return hit
	}
	
	/**
	 * @param hit {didHit: boolean, point: {x: float, y: float}, wallType: HORZ/VERT}
	 */
	hit(hit) {
		hit.didHit = false
		
		let horzDir = Math.sign(this.direction.x)
		let vertDir = Math.sign(this.direction.y)
		
		console.assert(horzDir !== NONE || vertDir !== NONE)
		let movesCount = 0
		if (horzDir != NONE) movesCount++
		if (vertDir != NONE) movesCount++
		
		let xsToLeftEdge = this.originPoint.x % this.tileWidth
		let xsToEdge = xsToLeftEdge
		let ysToDownEdge = this.originPoint.y % this.tileHeight
		let ysToEdge = ysToDownEdge
		if (horzDir === RIGHT) xsToEdge = this.tileWidth - xsToEdge
		if (vertDir === DOWN) ysToEdge = this.tileHeight - ysToEdge
		
		let col = Math.floor(this.originPoint.x / this.tileWidth)
		let row = Math.floor(this.originPoint.y / this.tileHeight)
		
		if (movesCount === 2) {
			// define first move
			let dxPerc = xsToEdge / this.tileWidth
			let dyPerc = ysToEdge / this.tileHeight
			
			//  TODO verticalFirst has a bug when dxPerc === dyPerc.

			// which line intersects in closer point - vertical or horizontal one?
			let vertEdgeX = (col + (horzDir === RIGHT ? horzDir : 0)) * this.tileWidth
			let horzEdgeY = (row + (horzDir === DOWN ? vertDir : 0)) * this.tileHeight
			
			let vertLineOrig = {x: vertEdgeX, y: horzEdgeY - vertDir*this.tileHeight}
			let vertLineDisp = {x: 0, y: vertDir*this.tileHeight}
			let horzLineOrig = {x: vertEdgeX - horzDir*this.tileWidth, y: horzEdgeY}
			let horzLineDisp = {x: horzDir*this.tileWidth, y: 0}

			let horzScalar = this.cross(this.diff(this.originPoint, horzLineOrig), horzLineDisp)
			let vertScalar = this.cross(this.diff(this.originPoint, vertLineOrig), vertLineDisp)
			horzScalar /= this.cross(horzLineDisp, this.direction)
			vertScalar /= this.cross(vertLineDisp, this.direction)
			
			// if horizontal line is closer than vertical line
			// then first move is going to cross the horizontal line
			let verticalFirst = vertScalar > horzScalar 
			
			// let verticalFirst = (dyPerc < dxPerc)
			this._moves[0] = verticalFirst ? VERT : HORZ
			this._moves[1] = verticalFirst ? HORZ : VERT
		}
		else {
			this._moves[0] = vertDir != NONE ? VERT : HORZ
		}
		

		let moveIndex = 0
		while (col >= 0 && col < this.colsCount && row >= 0 && row < this.rowsCount) {
			let currentMoveType = this._moves[moveIndex]
			
			if (currentMoveType === HORZ) {
				col += horzDir
			}
			else if (currentMoveType === VERT) {
				row += vertDir
			}
			
			if (this.isWall(col, row)) {
				hit.didHit = true
				hit.point.x = col * this.tileWidth
				hit.point.y = row * this.tileHeight
				
				if (horzDir === LEFT && currentMoveType === HORZ) {
					hit.point.x += this.tileWidth
				}
				
				if (vertDir === DOWN && currentMoveType === VERT) {
					hit.point.y += this.tileHeight
				}
				
				let minCoordDist = Math.min(xsToEdge, ysToEdge)
				
				if (currentMoveType === HORZ) {
					hit.point.y += ysToDownEdge + minCoordDist * vertDir 
					hit.wallType = VERT
				}
				else if (currentMoveType === VERT) {
					hit.point.x += xsToLeftEdge + minCoordDist * horzDir
					hit.wallType = HORZ
				}
				
				return
			}
			
			moveIndex = (moveIndex + 1) % movesCount
		}
	}
	
	isWall(col, row) {
		// let edges of map be walls
		if (col < 0 || col >= this.colsCount || row < 0 || row >= this.rowsCount)
			return true
			
		return this.walls[row][col] === WALL
		
		// return col >= 0 && col < this.colsCount
		// 	&& row >= 0 && row < this.rowsCount
		// 	&& this.walls[row][col] === WALL
	}
	
	diff(v1, v2) {
		return {x: v1.x - v2.x, y: v1.y - v2.y}
	}
	
	add(v1, v2) {
		return {x: v1.x + v2.x, y: v1.y + v2.y}
	}
	
	cross(v1, v2) {
		return v1.x * v2.y - v1.y * v2.x
	}
}
