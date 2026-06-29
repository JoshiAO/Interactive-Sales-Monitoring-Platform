export const getCurrentWeek = (cobDateStr?: string, weekMapping?: Record<string, { start: string; end: string }>): number => {
  const d = cobDateStr ? new Date(cobDateStr) : new Date();
  const day = d.getDate();

  if (weekMapping) {
    // Check if the day falls into any mapped week
    for (let w = 1; w <= 5; w++) {
      const mapping = weekMapping[w.toString()];
      if (mapping && mapping.start && mapping.end) {
        const start = parseInt(mapping.start);
        const end = parseInt(mapping.end);
        if (day >= start && day <= end) {
          return w;
        }
      }
    }
  }

  // Fallback to strict math
  return Math.min(Math.ceil(day / 7), 5);
};

export const getActiveWeeksCount = (weekMapping?: Record<string, { start: string; end: string }>): number => {
  if (!weekMapping) return 5;
  let hasAny = false;
  let count = 0;
  for (let w = 1; w <= 5; w++) {
    if (weekMapping[w.toString()]?.start || weekMapping[w.toString()]?.end) {
      hasAny = true;
      count++;
    }
  }
  return hasAny ? count : 5; // fallback to 5 if entirely blank
};
