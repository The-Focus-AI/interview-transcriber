export function secondsToTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid timestamp format. Expected HH:MM:SS');
  }
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

export function adjustTimestamp(timestamp: string, offsetSeconds: number): string {
  const seconds = timestampToSeconds(timestamp);
  return secondsToTimestamp(seconds + offsetSeconds);
}