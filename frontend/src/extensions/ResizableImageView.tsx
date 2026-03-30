import { useRef, useState, useCallback, useEffect } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Download } from "lucide-react";
import { getDataService } from "../services";

type Corner = "se" | "sw" | "ne" | "nw";

export function ResizableImageView({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { src, width, alt, title, attachmentId } = node.attrs as {
    src: string;
    width: number | null;
    alt: string | null;
    title: string | null;
    attachmentId: string | null;
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number | null>(width);
  const [hovered, setHovered] = useState(false);
  const widthRef = useRef<number | null>(width);

  // Sync width from node attrs
  useEffect(() => {
    setCurrentWidth(width);
    widthRef.current = width;
  }, [width]);

  const handleMouseDown = useCallback(
    (corner: Corner, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const img = imgRef.current;
      if (!img) return;

      const startX = e.clientX;
      const startWidth = img.getBoundingClientRect().width;
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const isLeft = corner === "sw" || corner === "nw";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const delta = isLeft ? -dx : dx;
        const newWidth = Math.max(100, Math.round(startWidth + delta));
        setCurrentWidth(newWidth);
        widthRef.current = newWidth;
        setResizing(true);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setResizing(false);

        const finalWidth =
          widthRef.current ?? imgRef.current?.getBoundingClientRect().width;
        if (finalWidth) {
          const finalHeight = Math.round(finalWidth / aspectRatio);
          updateAttributes({ width: finalWidth, height: finalHeight });
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [updateAttributes],
  );

  const handleDownload = useCallback(() => {
    if (attachmentId) {
      getDataService().openAttachmentFile(attachmentId);
    }
  }, [attachmentId]);

  const imgStyle: React.CSSProperties = {
    width: currentWidth ? `${currentWidth}px` : undefined,
    height: "auto",
    maxWidth: "100%",
  };

  return (
    <NodeViewWrapper>
      <div
        ref={containerRef}
        className={`resizable-image-container${selected ? " selected" : ""}${resizing ? " resizing" : ""}`}
        contentEditable={false}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          title={title ?? undefined}
          style={imgStyle}
          draggable={false}
        />

        {(selected || hovered) && (
          <>
            {(["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
              <div
                key={corner}
                className={`resize-handle resize-handle-${corner}`}
                onMouseDown={(e) => handleMouseDown(corner, e)}
              />
            ))}
          </>
        )}

        {attachmentId && hovered && (
          <button
            className="image-download-btn"
            onClick={handleDownload}
            title="Open in app"
            type="button"
          >
            <Download size={14} />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}
