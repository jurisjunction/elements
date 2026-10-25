/** Thrown by a tactic when a move is illegal; `message` is shown to the learner. */
export class TacticError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TacticError";
  }
}
