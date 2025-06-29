declare module 'colorthief' {
  class ColorThief {
    getColor(image: HTMLImageElement | HTMLCanvasElement): [number, number, number] | null;
    getPalette(image: HTMLImageElement | HTMLCanvasElement, colorCount?: number): [number, number, number][] | null;
  }
  export default ColorThief;
}