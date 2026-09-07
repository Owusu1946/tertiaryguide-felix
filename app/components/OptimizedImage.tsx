import Image, { type ImageProps } from "next/image";
import { ResponsiveMediaImg } from "@/app/components/ResponsiveMediaImg";
import {
  IMAGE_SIZES,
  SRCSET_WIDTHS,
  isCloudinaryImageUrl,
} from "@/lib/cloudinary-image";

/**
 * Cloudinary assets get responsive srcset + f_auto/q_auto (no custom
 * next/image loader — those functions cannot cross the RSC boundary).
 * Local / other remotes keep the default Next optimizer.
 */
export function OptimizedImage({ alt, className, sizes, src, fill, priority, unoptimized, ...props }: ImageProps) {
  const srcStr = typeof src === "string" ? src : null;
  const useCloudinary = Boolean(srcStr && isCloudinaryImageUrl(srcStr));
  const isSvgOrNavii = Boolean(srcStr && (srcStr.includes("api.navii.dev") || srcStr.endsWith(".svg") || srcStr.includes(".svg?")));
  const shouldBeUnoptimized = Boolean(unoptimized || isSvgOrNavii);

  if (useCloudinary && srcStr) {
    const cover =
      typeof className === "string" && className.includes("object-cover");
    const contain =
      typeof className === "string" && className.includes("object-contain");
    const fitClass = cover
      ? "object-cover object-center"
      : contain
        ? "object-contain object-center"
        : "object-cover object-center";

    return (
      <ResponsiveMediaImg
        src={srcStr}
        alt={alt ?? ""}
        sizes={typeof sizes === "string" ? sizes : IMAGE_SIZES.blogList}
        widths={priority ? SRCSET_WIDTHS.content : SRCSET_WIDTHS.feed}
        widthHint={priority ? 1200 : 800}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className={
          fill
            ? `absolute inset-0 h-full w-full ${fitClass} ${className ?? ""}`
            : className
        }
      />
    );
  }

  return (
    <Image
      {...props}
      src={src}
      alt={alt ?? ""}
      fill={fill}
      sizes={sizes}
      className={className}
      priority={priority}
      unoptimized={shouldBeUnoptimized}
    />
  );
}
