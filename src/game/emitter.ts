/**
 * Bus d'événements typé : le noyau du jeu annonce ce qui se passe (zombie touché, level-up, mort...)
 * et l'affichage, les sons, le HUD et le journal de run s'y abonnent. Le noyau ne connaît aucun
 * d'entre eux.
 */
export class Emitter<E extends Record<string, unknown>> {
  private handlers: { [K in keyof E]?: ((payload: E[K]) => void)[] } = {};

  /** S'abonne ; renvoie la fonction de désabonnement. */
  on<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void {
    (this.handlers[type] ??= []).push(fn);
    return () => { this.handlers[type] = this.handlers[type]!.filter((f) => f !== fn); };
  }

  emit<K extends keyof E>(type: K, payload: E[K]) {
    for (const fn of this.handlers[type] ?? []) fn(payload);
  }
}
