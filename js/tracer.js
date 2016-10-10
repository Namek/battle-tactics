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

		this.origin = {x: 0, y: 0}
		this.direction = {x: 0, y: 0}
		this._moves = [0, 0]
	}

	setup(origin, direction) {
		this.origin = origin
		this.direction = direction
		return this
	}

	setupXY(originX, originY, directionX, directionY) {
		this.origin.x = originX
		this.origin.y = originY
		this.direction.x = directionX
		this.direction.y = directionY
		return this
	}

	getHit() {
    let hit = {
			point: {x: 0, y: 0},
			didHitWall: false
		}
		this.hit(hit)
    return hit
	}

	/**
	 * @param hit {didHitWall: boolean, point: {x: float, y: float}, wallType: HORZ/VERT}
	 */
	hit(hit) {
		hit.didHitWall = false

		let horzDir = Math.sign(this.direction.x)
		let vertDir = Math.sign(this.direction.y)

		console.assert(horzDir !== NONE || vertDir !== NONE)
		let movesCount = 0
		if (horzDir != NONE) movesCount++
		if (vertDir != NONE) movesCount++

		let xsToLeftEdge = this.origin.x % this.tileWidth
		let xsToEdge = xsToLeftEdge
		let ysToDownEdge = this.origin.y % this.tileHeight
		let ysToEdge = ysToDownEdge
		if (horzDir === RIGHT) xsToEdge = this.tileWidth - xsToEdge
		if (vertDir === DOWN) ysToEdge = this.tileHeight - ysToEdge

		let col = Math.floor(this.origin.x / this.tileWidth)
		let row = Math.floor(this.origin.y / this.tileHeight)

		while (col >= 0 && col < this.colsCount && row >= 0 && row < this.rowsCount) {
			// which line intersects in closer point - vertical or horizontal one?
			let vertEdgeX = (col + (horzDir === RIGHT ? horzDir : 0)) * this.tileWidth
			let horzEdgeY = (row + (vertDir === DOWN ? vertDir : 0)) * this.tileHeight

			let vertLineOrig = {x: vertEdgeX, y: horzEdgeY - vertDir*this.tileHeight}
			let vertLineDisp = {x: 0, y: vertDir*this.tileHeight}
			let horzLineOrig = {x: vertEdgeX - horzDir*this.tileWidth, y: horzEdgeY}
			let horzLineDisp = {x: horzDir*this.tileWidth, y: 0}

			let horzScalar = this.cross(this.diff(this.origin, horzLineOrig), horzLineDisp)
			let horzCross = this.cross(horzLineDisp, this.direction)
			let vertScalar = this.cross(this.diff(this.origin, vertLineOrig), vertLineDisp)
			let vertCross = this.cross(vertLineDisp, this.direction)

			if (horzCross === 0) {
				if (horzScalar === 0) {
					// two lines are collinear
					horzScalar = Infinity
				}
				else {
					// lines are parallel and non-intersecting
					horzScalar = Infinity
				}
			}
			else {
				horzScalar /= horzCross
			}

			vertScalar = vertCross !== 0 ? vertScalar / vertCross : Infinity

			// if horizontal line is closer than vertical line
			// then first move is going to cross the horizontal line
			let isVerticalMove = vertScalar > horzScalar

			if (isVerticalMove) {
				row += vertDir
			}
			else {
				col += horzDir
			}

			let isOutsideMap = col < 0 || col >= this.colsCount || row < 0 || row >= this.rowsCount
			let isWall = !isOutsideMap && this.isWall(col, row)

			if (isWall || isOutsideMap) {
				hit.didHitWall = isWall

				if (isVerticalMove) {
					hit.point.x = this.origin.x
					hit.point.y = horzLineOrig.y

					if (horzScalar !== Infinity) {
						hit.point.x += (this.direction.x * horzScalar)
					}

					hit.wallType = HORZ
				}
				else {
					hit.point.x = vertLineOrig.x
					hit.point.y = this.origin.y

					if (vertScalar !== Infinity) {
						hit.point.y += (this.direction.y * vertScalar)
					}

					hit.wallType = VERT
				}

				break
			}
		}
	}

	isWall(col, row) {
		return this.walls[row][col] === WALL
	}

	diff(v1, v2) {
		return {x: v1.x - v2.x, y: v1.y - v2.y}
	}

	cross(v1, v2) {
		return v1.x * v2.y - v1.y * v2.x
	}
}
