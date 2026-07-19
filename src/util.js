export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}

// Fisher-Yates — .sort(() => Math.random() - 0.5) is a biased shuffle (some
// permutations are more likely than others depending on the sort algorithm).
// Mutates and returns arr.
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
