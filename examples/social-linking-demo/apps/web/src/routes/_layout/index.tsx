import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Github, Clipboard } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export const Route = createFileRoute("/_layout/")({
  component: HomeComponent,
  loader: async () => {
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/elliotBraem/better-near-auth/main/README.md"
      );
      let content = await response.text();
      
      // Remove markdown lint comments and HTML center div
      content = content
        .replace(/<!-- markdownlint-disable[^>]*-->/g, '')
        .replace(/<div align="center">[\s\S]*?<\/div>/g, '')
        .trim();
      
      return { readme: content };
    } catch (error) {
      console.error("Failed to fetch README:", error);
      return { readme: "" };
    }
  },
});

function HomeComponent() {
  const [copied, setCopied] = useState(false);
  const { readme } = Route.useLoaderData();

  const copyLLMContent = async () => {
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/elliotBraem/better-near-auth/main/LLM.txt"
      );
      const content = await response.text();
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("LLM.txt copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy content:", error);
      toast.error("Failed to copy content. Please try again.");
    }
  };



  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 lg:py-12">
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
            <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-semibold">better-near-auth</h1>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={copyLLMContent}
                className="flex items-center gap-2"
              >
                <Clipboard className="h-4 w-4" />
                {copied ? "Copied!" : "Copy LLM.txt"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="flex items-center gap-2"
              >
                <a
                  href="https://github.com/elliotBraem/better-near-auth"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </Button>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-full content-container">
            <div className="markdown-content">
                <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mt-4 sm:mt-6 lg:mt-8 mb-2 sm:mb-3 lg:mb-4 first:mt-0">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-2 sm:mb-3 lg:mb-4">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm sm:text-base lg:text-lg xl:text-xl font-medium mt-3 sm:mt-4 lg:mt-6 mb-1.5 sm:mb-2 lg:mb-3">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 sm:mb-3 lg:mb-4 leading-5 sm:leading-6 lg:leading-7 text-xs sm:text-sm lg:text-base">{children}</p>
                  ),
                  code: ({ className, children, ...props }: any) => {
                    const isInline = !className?.includes('language-');
                    if (isInline) {
                      return (
                        <code
                          className="bg-muted px-1 py-0.5 rounded text-xs sm:text-sm font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code
                        className={`${className} block bg-muted p-2 sm:p-3 lg:p-4 rounded-lg text-xs font-mono overflow-x-auto`}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="bg-muted p-2 sm:p-3 lg:p-4 rounded-lg overflow-x-auto mb-3 sm:mb-4">
                      {children}
                    </pre>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-blue-600 font-medium"
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-3 sm:mb-4">
                      <table className="min-w-full border-collapse border border-border text-xs sm:text-sm lg:text-base">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border bg-muted px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-left font-medium text-xs sm:text-sm lg:text-base">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm lg:text-base">{children}</td>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-2 sm:mb-3 lg:mb-4 space-y-0.5 sm:space-y-1 text-xs sm:text-sm lg:text-base pl-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-2 sm:mb-3 lg:mb-4 space-y-0.5 sm:space-y-1 text-xs sm:text-sm lg:text-base pl-2">{children}</ol>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 sm:border-l-4 border-border pl-2 sm:pl-3 lg:pl-4 italic mb-2 sm:mb-3 lg:mb-4 text-xs sm:text-sm lg:text-base">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {readme || "Documentation content is currently unavailable."}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
