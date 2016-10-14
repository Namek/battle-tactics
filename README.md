# Battle Tactics

Turn-based game prototype where units move between corners, peek and fire.

## Rules

There are 4 actions:

 * move to adjoint field
 * peek over the corner behind wall
 * fire
 * wait

Every action has a cost of **action points**.

**Result of peeking**: mark on board all positions of enemy units that were seen.
For a longer peek there is a path rather than single point.


## Simulation

All actions are equal to one or more steps. **Move** is always 1 step, however **peeking** and **firing** are enabled until other action starts or turn ends.

Each turn consists of:

1. marking all units who are peeking
2. then simulating moves and firing


More detailed - on every step simulate actions for each unit:

 1. if any unit is going to start peeking this round, then turn the peek mode for them

 2. fire/move simulation:
  - move:
    - if current unit has a move, then he moves
    - after move, if he's spotted then he's marked on board to the spotting players
    - if enemy units are shooting then the closest one hits the unit and takes the point

  - fire:
    - take down the closest spotted unit on current step
    - if enemy unit is firing at us at the same time then both units are down
