import { createElement, ChevronRight, ChevronDown, ChevronUp, Pin, CircleHelp, X, Download, Copy, Check, PanelLeftClose, PanelLeftOpen, type IconNode } from "lucide";

/** Create an inline Lucide SVG icon (24x24 viewBox, sized by CSS). */
export function icon(node: IconNode, cls = ""): SVGElement {
  const svg = createElement(node);
  svg.setAttribute("class", ("icon " + cls).trim());
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

export const Icons = { ChevronRight, ChevronDown, ChevronUp, Pin, CircleHelp, X, Download, Copy, Check, PanelLeftClose, PanelLeftOpen };
