// based on: http://www.briangrinstead.com/blog/astar-search-algorithm-in-javascript

let astar = {
	init: function(grid) {
		for (let y = 0, yl = grid.length; y < yl; y++) {
			let row = grid[y]
			for (let x = 0, xl = row.length; x < xl; x++) {
				row[x] = {
					x,
					y,
					pos: { x, y },
					isWall: !!row[x],
					f: 0,
					g: 0,
					h: 0,
					cost: 1,
					visited: false,
					closed: false,
					parent: null
				}
			}
		}
	},
	heap: function() {
		return new BinaryHeap(function(node) {
			return node.f
		})
	},
	search: function(grid, startX, startY, endX, endY, diagonal = undefined, heuristic = undefined) {
		astar.init(grid)
		heuristic = heuristic || astar.manhattan
		diagonal = !!diagonal

		let start = grid[startY][startX]
		let end = grid[endY][endX]

		let openHeap = astar.heap()

		openHeap.push(start)

		while (openHeap.size() > 0) {
			// Grab the lowest f(x) to process next.  Heap keeps this sorted for us.
			let currentNode = openHeap.pop()

			// End case -- result has been found, return the traced path.
			if (currentNode === end) {
				let curr = currentNode
				let ret = []
				while (curr.parent) {
					ret.push(curr)
					curr = curr.parent
				}
				return ret.reverse()
			}

			// Normal case -- move currentNode from open to closed, process each of its neighbors.
			currentNode.closed = true

			// Find all neighbors for the current node. Optionally find diagonal neighbors as well (false by default).
			let neighbors = astar.neighbors(grid, currentNode, diagonal)

			for (let i = 0, il = neighbors.length; i < il; i++) {
				let neighbor = neighbors[i]

				if (neighbor.closed || neighbor.isWall) {
					// Not a valid node to process, skip to next neighbor.
					continue
				}

				// The g score is the shortest distance from start to current node.
				// We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
				let gScore = currentNode.g + neighbor.cost
				let beenVisited = neighbor.visited

				if (!beenVisited || gScore < neighbor.g) {
					// Found an optimal (so far) path to this node.  Take score for node to see how good it is.
					neighbor.visited = true
					neighbor.parent = currentNode
					neighbor.h = neighbor.h || heuristic(neighbor.pos, end.pos)
					neighbor.g = gScore
					neighbor.f = neighbor.g + neighbor.h

					if (!beenVisited) {
						// Pushing to heap will put it in proper place based on the 'f' value.
						openHeap.push(neighbor)
					}
					else {
						// Already seen the node, but since it has been rescored we need to reorder it in the heap
						openHeap.rescoreElement(neighbor)
					}
				}
			}
		}

		// No result was found - empty array signifies failure to find path.
		return []
	},
	manhattan: function(pos0, pos1) {
		// See list of heuristics: http://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html
		let d1 = Math.abs(pos1.x - pos0.x)
		let d2 = Math.abs(pos1.y - pos0.y)
		return d1 + d2
	},
	neighbors: function(grid, node, diagonals) {
		let ret = []
		let x = node.x
		let y = node.y

		// West
		if (grid[y] && grid[y][x-1]) {
			ret.push(grid[y][x-1])
		}

		// East
		if (grid[y] && grid[y][x+1]) {
			ret.push(grid[y][x+1])
		}

		// South
		if (grid[y-1] && grid[y-1][x]) {
			ret.push(grid[y-1][x])
		}

		// North
		if (grid[y+1] && grid[y+1][x]) {
			ret.push(grid[y + 1][x])
		}

		if (diagonals) {
			// Southwest
			if (grid[y-1] && grid[y-1][x-1]) {
				ret.push(grid[y-1][x-1])
			}

			// Southeast
			if (grid[y-1] && grid[y-1][x+1]) {
				ret.push(grid[y-1][x+1])
			}

			// Northwest
			if (grid[y+1] && grid[y+1][x-1]) {
				ret.push(grid[y+1][x-1])
			}

			// Northeast
			if (grid[y+1] && grid[y+1][x+1]) {
				ret.push(grid[y+1][x+1])
			}
		}

		return ret
	}
}