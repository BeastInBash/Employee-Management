import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a task description written in Markdown (GitHub flavour: lists,
 * checklists, tables, strikethrough, autolinks). Raw HTML in the text is not
 * rendered, so a description can't inject markup or scripts. Loaded lazily
 * through MarkdownView, so the parser never weighs down the first page load.
 */
const MarkdownBody = ({ text }: { text: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      // Links open in a new tab, so following one never loses the board.
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    }}
  >
    {text}
  </ReactMarkdown>
);

export default MarkdownBody;
