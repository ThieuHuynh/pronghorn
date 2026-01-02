import { useMemo } from "react";
import { Circle, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SlideContent {
  regionId: string;
  type: string;
  data: any;
}

interface Slide {
  id: string;
  order: number;
  layoutId: string;
  title: string;
  subtitle?: string;
  content: SlideContent[];
  notes?: string;
  imageUrl?: string;
}

interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  muted: string;
}

interface SlideRendererProps {
  slide: Slide;
  layouts?: any[];
  theme?: "default" | "light" | "vibrant";
  className?: string;
  isPreview?: boolean;
  isFullscreen?: boolean;
}

// Markdown renderer for consistent styling
const MarkdownText = ({ content, style }: { content: string; style?: React.CSSProperties }) => (
  <ReactMarkdown
    components={{
      p: ({ children }) => <p className="mb-2" style={style}>{children}</p>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
      li: ({ children }) => <li style={style}>{children}</li>,
    }}
  >
    {content}
  </ReactMarkdown>
);

export function SlideRenderer({ 
  slide, 
  layouts, 
  theme = "default", 
  className = "", 
  isPreview = false, 
  isFullscreen = false 
}: SlideRendererProps) {
  const { layoutId, title, subtitle, content, imageUrl } = slide;

  const themeColors = useMemo((): ThemeColors => {
    switch (theme) {
      case "light":
        return {
          background: "hsl(0 0% 100%)",
          foreground: "hsl(222 47% 11%)",
          primary: "hsl(217 91% 50%)",
          muted: "hsl(215 16% 47%)",
        };
      case "vibrant":
        return {
          background: "hsl(260 50% 10%)",
          foreground: "hsl(0 0% 100%)",
          primary: "hsl(280 100% 65%)",
          muted: "hsl(260 20% 70%)",
        };
      default:
        return {
          background: "hsl(222 47% 11%)",
          foreground: "hsl(210 40% 98%)",
          primary: "hsl(217 91% 60%)",
          muted: "hsl(215 20% 65%)",
        };
    }
  }, [theme]);

  // === UNIFIED CONTENT EXTRACTION ===
  const getContentByType = (type: string) => content?.find(c => c.type === type);
  const getContentByRegion = (regionId: string) => content?.find(c => c.regionId === regionId);
  
  // Get main content - check all possible formats
  const mainContent = useMemo(() => {
    return getContentByRegion("content") || 
           getContentByRegion("main") || 
           getContentByRegion("bullets") ||
           getContentByType("richtext") ||
           getContentByType("text") ||
           getContentByType("bullets");
  }, [content]);

  const imageContent = getContentByType("image") || getContentByRegion("image");
  const timelineContent = getContentByType("timeline") || getContentByRegion("timeline");
  const statsContent = content?.filter(c => c.type === "stat");
  const gridContent = getContentByType("icon-grid") || getContentByRegion("grid");

  // Extract the actual text/items from mainContent
  const mainText = mainContent?.data?.text || (typeof mainContent?.data === 'string' ? mainContent.data : null);
  const mainItems = mainContent?.data?.items;

  // Get image URL from various possible locations
  const getImageUrl = () => {
    return imageContent?.data?.url || 
           imageContent?.data?.imageUrl || 
           getContentByRegion("diagram")?.data?.url ||
           imageUrl;
  };

  const imgUrl = getImageUrl();
  const isSectionDivider = layoutId === "section-divider";
  const isFullBleed = ["title-cover", "section-divider"].includes(layoutId);

  // === RENDER HELPERS ===
  const renderTitle = (centered = false) => (
    <div className={`shrink-0 px-4 sm:px-6 lg:px-8 pt-4 lg:pt-6 pb-2 ${centered ? 'text-center' : ''}`}>
      <h2 
        className={`font-bold font-raleway leading-tight ${
          isPreview ? 'text-base sm:text-lg' : 'text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl'
        }`}
        style={{ color: themeColors.foreground }}
      >
        {title}
      </h2>
      {subtitle && (
        <p 
          className={`mt-1 opacity-80 ${isPreview ? 'text-xs' : 'text-xs sm:text-sm md:text-base'}`}
          style={{ color: themeColors.muted }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );

  const renderBullets = (items: any[]) => (
    <ul className="space-y-2 sm:space-y-3">
      {items.map((item: any, i: number) => (
        <li 
          key={i} 
          className="flex items-start gap-2 sm:gap-3"
          style={{ color: themeColors.foreground }}
        >
          <Circle 
            className="flex-shrink-0 mt-1.5" 
            style={{ 
              width: isPreview ? 6 : 8, 
              height: isPreview ? 6 : 8,
              color: themeColors.primary,
              fill: themeColors.primary,
            }} 
          />
          <div className={`flex-1 ${isPreview ? 'text-xs' : 'text-sm md:text-base'}`}>
            {typeof item === "string" ? (
              <MarkdownText content={item} style={{ color: themeColors.foreground }} />
            ) : (
              <>
                <span className="font-semibold">{item.title}</span>
                {item.description && (
                  <p className="mt-0.5 text-sm" style={{ color: themeColors.muted }}>
                    {item.description}
                  </p>
                )}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  const renderTextContent = () => {
    if (mainItems) {
      return renderBullets(mainItems);
    }
    if (mainText) {
      return (
        <div 
          className={`leading-relaxed ${isPreview ? 'text-xs' : 'text-sm md:text-base'}`}
          style={{ color: themeColors.foreground }}
        >
          <MarkdownText content={mainText} style={{ color: themeColors.foreground }} />
        </div>
      );
    }
    return null;
  };

  const renderImage = (url: string, alt?: string) => (
    <div className="w-full h-full min-h-[100px] relative overflow-hidden rounded-lg">
      <img
        src={url}
        alt={alt || "Slide image"}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    </div>
  );

  const renderTimeline = (steps: any[]) => (
    <div className="flex flex-col gap-3 sm:gap-4">
      {steps.map((step: any, i: number) => (
        <div key={i} className="flex items-start gap-3 sm:gap-4">
          <div 
            className={`shrink-0 rounded-full flex items-center justify-center font-bold ${
              isPreview ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
            }`}
            style={{ background: themeColors.primary, color: themeColors.background }}
          >
            {i + 1}
          </div>
          <div className="flex-1 pt-0.5">
            <div 
              className={`font-semibold ${isPreview ? 'text-xs' : 'text-sm'}`}
              style={{ color: themeColors.foreground }}
            >
              {step.title}
            </div>
            {step.description && (
              <div className="text-xs mt-0.5" style={{ color: themeColors.muted }}>
                {step.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderStats = (stats: SlideContent[]) => (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {stats.map((stat, i) => (
        <div 
          key={i} 
          className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-lg" 
          style={{ background: `${themeColors.primary}11` }}
        >
          <div 
            className={`font-bold font-raleway ${isPreview ? 'text-xl' : 'text-2xl md:text-3xl'}`}
            style={{ color: themeColors.primary }}
          >
            {stat.data?.value || "0"}
          </div>
          <div className="text-xs mt-1 text-center" style={{ color: themeColors.muted }}>
            {stat.data?.label || ""}
          </div>
        </div>
      ))}
    </div>
  );

  const renderIconGrid = (items: any[]) => (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {items.map((item: any, i: number) => (
        <div key={i} className="flex flex-col items-center text-center p-2 sm:p-3">
          <div 
            className={`rounded-lg flex items-center justify-center mb-2 ${
              isPreview ? 'w-8 h-8' : 'w-10 h-10'
            }`}
            style={{ background: `${themeColors.primary}22` }}
          >
            <CheckCircle2 
              style={{ 
                width: isPreview ? 16 : 24, 
                height: isPreview ? 16 : 24, 
                color: themeColors.primary 
              }} 
            />
          </div>
          <div 
            className={`font-semibold ${isPreview ? 'text-xs' : 'text-sm'}`}
            style={{ color: themeColors.foreground }}
          >
            {item.title}
          </div>
          <div className="text-xs" style={{ color: themeColors.muted }}>
            {item.description}
          </div>
        </div>
      ))}
    </div>
  );

  // === LAYOUT RENDERING ===
  // All layouts use the same flex-based approach that adapts via CSS

  const containerClass = `
    relative font-raleway w-full h-full
    ${isFullscreen ? '' : 'aspect-video'}
    ${className}
  `;

  const containerStyle = {
    background: isSectionDivider 
      ? `linear-gradient(135deg, ${themeColors.primary}, hsl(217 80% 45%))` 
      : themeColors.background,
    color: themeColors.foreground,
  };

  // Title cover / Section divider
  if (isFullBleed) {
    return (
      <div className={containerClass} style={containerStyle}>
        {imgUrl && (
          <div className="absolute inset-0">
            <img 
              src={imgUrl} 
              alt="" 
              className="w-full h-full object-cover opacity-80"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}
        {isFullBleed && !isSectionDivider && !imgUrl && (
          <div 
            className="absolute inset-0 z-0"
            style={{
              background: `linear-gradient(135deg, ${themeColors.background} 0%, hsl(217 33% 17%) 100%)`,
            }}
          />
        )}
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 sm:p-8 lg:p-12 text-center">
          <h1 
            className={`font-bold font-raleway leading-tight ${
              isPreview 
                ? 'text-xl sm:text-2xl' 
                : 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl'
            }`}
            style={{ color: themeColors.foreground }}
          >
            {title}
          </h1>
          {subtitle && (
            <p 
              className={`mt-3 sm:mt-4 opacity-80 ${
                isPreview ? 'text-sm' : 'text-base sm:text-lg md:text-xl'
              }`}
              style={{ color: themeColors.muted }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Image layouts (image-left, image-right, architecture)
  if (["image-left", "image-right", "architecture"].includes(layoutId)) {
    const hasImage = !!imgUrl;
    const isArchitecture = layoutId === "architecture";
    const imageFirst = layoutId === "image-left";
    
    return (
      <div className={containerClass} style={containerStyle}>
        <div className={`
          flex flex-col h-full
          ${isFullscreen ? 'lg:flex-row' : ''}
        `}>
          {/* Image section - on mobile: top for image-left, bottom for image-right */}
          {hasImage && imageFirst && (
            <div className={`
              shrink-0 
              ${isFullscreen ? 'h-[35%] lg:h-full lg:w-[40%]' : 'h-[40%]'}
              p-2 sm:p-4
            `}>
              {renderImage(imgUrl, imageContent?.data?.alt)}
            </div>
          )}
          
          {/* Content section */}
          <div className={`
            flex-1 flex flex-col min-h-0
            ${isFullscreen ? 'lg:flex-1' : ''}
          `}>
            {renderTitle()}
            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 overflow-y-auto min-h-0">
              {isArchitecture && !hasImage ? (
                <div 
                  className="text-center p-8 rounded-lg border-2 border-dashed h-full flex items-center justify-center"
                  style={{ borderColor: themeColors.muted, color: themeColors.muted }}
                >
                  Architecture Diagram Placeholder
                </div>
              ) : (
                renderTextContent()
              )}
            </div>
          </div>

          {/* Image at bottom for image-right */}
          {hasImage && !imageFirst && !isArchitecture && (
            <div className={`
              shrink-0 
              ${isFullscreen ? 'h-[35%] lg:h-full lg:w-[40%]' : 'h-[40%]'}
              p-2 sm:p-4
            `}>
              {renderImage(imgUrl, imageContent?.data?.alt)}
            </div>
          )}

          {/* Architecture shows image in content area if available */}
          {isArchitecture && hasImage && (
            <div className="flex-1 px-4 sm:px-6 pb-4">
              {renderImage(imgUrl, "Architecture diagram")}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Stats grid
  if (layoutId === "stats-grid" && statsContent && statsContent.length > 0) {
    return (
      <div className={containerClass} style={containerStyle}>
        <div className="flex flex-col h-full">
          {renderTitle()}
          <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 flex items-center justify-center min-h-0">
            {renderStats(statsContent)}
          </div>
        </div>
      </div>
    );
  }

  // Timeline
  if (layoutId === "timeline" && timelineContent?.data?.steps) {
    return (
      <div className={containerClass} style={containerStyle}>
        <div className="flex flex-col h-full">
          {renderTitle()}
          <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 overflow-y-auto min-h-0">
            {renderTimeline(timelineContent.data.steps)}
          </div>
        </div>
      </div>
    );
  }

  // Icon grid
  if (layoutId === "icon-grid" && gridContent?.data?.items) {
    return (
      <div className={containerClass} style={containerStyle}>
        <div className="flex flex-col h-full">
          {renderTitle()}
          <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 flex items-center min-h-0">
            <div className="w-full">
              {renderIconGrid(gridContent.data.items)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper to render column content (handles items, text, or richtext)
  const renderColumnContent = (colContent: SlideContent | undefined) => {
    if (!colContent?.data) return null;
    
    // If it has items, render as bullets
    if (colContent.data.items) {
      return renderBullets(colContent.data.items);
    }
    
    // If it has text, render as markdown
    const textContent = colContent.data.text || (typeof colContent.data === 'string' ? colContent.data : null);
    if (textContent) {
      return (
        <div 
          className={`leading-relaxed ${isPreview ? 'text-xs' : 'text-sm md:text-base'}`}
          style={{ color: themeColors.foreground }}
        >
          <MarkdownText content={textContent} style={{ color: themeColors.foreground }} />
        </div>
      );
    }
    
    return null;
  };

  // Two-column / Comparison
  if (["two-column", "comparison"].includes(layoutId)) {
    const leftContent = getContentByRegion("left-content") || getContentByRegion("left");
    const rightContent = getContentByRegion("right-content") || getContentByRegion("right");
    
    const hasLeft = leftContent?.data?.items || leftContent?.data?.text || typeof leftContent?.data === 'string';
    const hasRight = rightContent?.data?.items || rightContent?.data?.text || typeof rightContent?.data === 'string';
    
    return (
      <div className={containerClass} style={containerStyle}>
        <div className="flex flex-col h-full">
          {renderTitle()}
          <div className={`
            flex-1 px-4 sm:px-6 lg:px-8 pb-4 overflow-y-auto min-h-0
            flex flex-col gap-4
            ${isFullscreen ? 'lg:flex-row lg:gap-8' : ''}
          `}>
            {hasLeft && (
              <div className={isFullscreen ? 'lg:flex-1' : ''}>
                {leftContent?.data?.title && (
                  <h3 
                    className={`font-semibold mb-2 ${isPreview ? 'text-xs' : 'text-sm'}`}
                    style={{ color: themeColors.primary }}
                  >
                    {leftContent.data.title}
                  </h3>
                )}
                {renderColumnContent(leftContent)}
              </div>
            )}
            {hasRight && (
              <div className={isFullscreen ? 'lg:flex-1' : ''}>
                {rightContent?.data?.title && (
                  <h3 
                    className={`font-semibold mb-2 ${isPreview ? 'text-xs' : 'text-sm'}`}
                    style={{ color: themeColors.primary }}
                  >
                    {rightContent.data.title}
                  </h3>
                )}
                {renderColumnContent(rightContent)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: title-content, bullets, or any unrecognized layout
  return (
    <div className={containerClass} style={containerStyle}>
      <div className="flex flex-col h-full">
        {renderTitle()}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 overflow-y-auto min-h-0">
          {renderTextContent()}
        </div>
      </div>
    </div>
  );
}
