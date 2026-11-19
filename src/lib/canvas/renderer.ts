import {
  WORLD_SIZE,
  type Point,
  type Stroke,
} from "@shared/world";

const MAX_DEVICE_PIXEL_RATIO = 2;
const MIN_LINE_WIDTH = 0.1;

interface RenderStroke extends Stroke {
  points: Point[];
}

interface ViewTransform {
  scale: number;
  originX: number;
  originY: number;
}

function clonePoint([x, y]: Point): Point {
  return [x, y];
}

function cloneStroke(stroke: Stroke): RenderStroke {
  return {
    ...stroke,
    points: stroke.points.map(clonePoint),
  };
}

/**
 * Imperative renderer over a transparent 2D canvas.
 *
 * World coordinates are always 0..WORLD_SIZE. The square world is centred
 * (letterboxed) inside the canvas element, so a non-square container never
 * distorts the drawing.
 */
export class WorldRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly strokesById = new Map<string, RenderStroke>();
  private strokes: RenderStroke[] = [];
  private view: ViewTransform | null = null;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, container?: HTMLElement | null) {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error("2D canvas context is not available.");
    }

    this.canvas = canvas;
    this.context = context;
    this.container = container ?? canvas;

    if (typeof ResizeObserver === "undefined") {
      this.resizeObserver = null;
    } else {
      this.resizeObserver = new ResizeObserver(() => {
        this.syncSize();
      });
      this.resizeObserver.observe(this.container);
    }

    this.syncSize();
  }

  get hasStrokes(): boolean {
    return this.strokes.length > 0;
  }

  setStrokes(strokes: Stroke[]): void {
    this.strokes = [];
    this.strokesById.clear();

    for (const stroke of strokes) {
      if (this.strokesById.has(stroke.id)) {
        continue;
      }
      const copy = cloneStroke(stroke);
      this.strokes.push(copy);
      this.strokesById.set(copy.id, copy);
    }

    this.redraw();
  }

  startStroke(stroke: Stroke): void {
    if (this.strokesById.has(stroke.id)) {
      return;
    }

    const copy = cloneStroke(stroke);
    this.strokes.push(copy);
    this.strokesById.set(copy.id, copy);
    this.drawWholeStroke(copy);
  }

  appendPoints(strokeId: string, points: Point[]): void {
    if (points.length === 0) {
      return;
    }

    const stroke = this.strokesById.get(strokeId);
    if (!stroke) {
      return;
    }

    const incoming = points.map(clonePoint);
    const previousLast =
      stroke.points.length > 0 ? stroke.points[stroke.points.length - 1] : null;

    stroke.points.push(...incoming);
    this.drawAppendedPoints(stroke, previousLast, incoming);
  }

  removeStroke(strokeId: string): void {
    if (!this.strokesById.delete(strokeId)) {
      return;
    }

    this.strokes = this.strokes.filter((stroke) => stroke.id !== strokeId);
    this.redraw();
  }

  clear(): void {
    this.strokes = [];
    this.strokesById.clear();
    this.redraw();
  }

  syncSize(): void {
    if (this.disposed) {
      return;
    }

    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this.view = null;
      return;
    }

    const devicePixelRatio =
      typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const ratio = Math.min(
      MAX_DEVICE_PIXEL_RATIO,
      Math.max(1, devicePixelRatio),
    );
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    const square = Math.min(width, height);
    const nextView: ViewTransform = {
      scale: square / WORLD_SIZE,
      originX: (width - square) / 2,
      originY: (height - square) / 2,
    };
    const sizeChanged =
      this.canvas.width !== width || this.canvas.height !== height;
    const viewChanged =
      !this.view ||
      this.view.scale !== nextView.scale ||
      this.view.originX !== nextView.originX ||
      this.view.originY !== nextView.originY;

    if (sizeChanged) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.view = nextView;

    if (sizeChanged || viewChanged) {
      this.redraw();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.resizeObserver?.disconnect();
  }

  private redraw(): void {
    this.resetCanvas();
    if (!this.view) {
      return;
    }

    this.context.setTransform(
      this.view.scale,
      0,
      0,
      this.view.scale,
      this.view.originX,
      this.view.originY,
    );

    for (const stroke of this.strokes) {
      this.drawWholeStroke(stroke);
    }
  }

  private resetCanvas(): void {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawWholeStroke(stroke: RenderStroke): void {
    if (!this.view || stroke.points.length === 0) {
      return;
    }

    this.applyStrokeStyle(stroke);

    if (stroke.points.length === 1) {
      this.drawDot(stroke.points[0], stroke.width);
    } else {
      this.context.beginPath();
      this.context.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (let index = 1; index < stroke.points.length; index += 1) {
        const point = stroke.points[index];
        this.context.lineTo(point[0], point[1]);
      }
      this.context.stroke();
    }

    this.context.restore();
  }

  private drawAppendedPoints(
    stroke: RenderStroke,
    previousLast: Point | null,
    appended: Point[],
  ): void {
    if (!this.view || appended.length === 0) {
      return;
    }

    this.applyStrokeStyle(stroke);

    if (previousLast) {
      this.context.beginPath();
      this.context.moveTo(previousLast[0], previousLast[1]);
      for (const point of appended) {
        this.context.lineTo(point[0], point[1]);
      }
      this.context.stroke();
    } else {
      const first = appended[0];
      this.drawDot(first, stroke.width);
      if (appended.length > 1) {
        this.context.beginPath();
        this.context.moveTo(first[0], first[1]);
        for (let index = 1; index < appended.length; index += 1) {
          const point = appended[index];
          this.context.lineTo(point[0], point[1]);
        }
        this.context.stroke();
      }
    }

    this.context.restore();
  }

  private applyStrokeStyle(stroke: RenderStroke): void {
    this.context.save();
    this.context.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    this.context.strokeStyle = stroke.color;
    this.context.fillStyle = stroke.color;
    this.context.lineWidth = Math.max(stroke.width, MIN_LINE_WIDTH);
    this.context.lineCap = "round";
    this.context.lineJoin = "round";
  }

  private drawDot(point: Point, width: number): void {
    this.context.beginPath();
    this.context.arc(
      point[0],
      point[1],
      Math.max(width, MIN_LINE_WIDTH) / 2,
      0,
      Math.PI * 2,
    );
    this.context.fill();
  }
}
