import sanitizeHtml from "sanitize-html";
export function safeBlogHtml(value: unknown) {
  return sanitizeHtml(typeof value === "string" ? value.slice(0, 100000) : "", {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  });
}
