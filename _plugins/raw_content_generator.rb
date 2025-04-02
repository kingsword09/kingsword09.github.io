# frozen_string_literal: true

module Jekyll
  # Generates a 'raw_markdown' variable for posts containing the original Markdown content.
  class RawContentGenerator < Generator
    safe true
    priority :lowest

    def generate(site)
      site.posts.docs.each do |post|
        begin
          # Read the raw content from the source file
          raw_content = File.read(post.path, encoding: 'UTF-8')
          # Find the end of the YAML front matter (second '---')
          content_start_index = raw_content.index("\n---", raw_content.index('---') + 3)

          if content_start_index
            # Extract content after the second '---'
            markdown_content = raw_content[(content_start_index + 4)..-1]
          else
            # Fallback for files potentially without front matter closing dashes
            # This might include front matter if the format is unexpected.
            # Check if the file starts with '---' for basic front matter detection
            markdown_content = if raw_content.strip.start_with?('---')
                                # Try to find the first blank line after --- if no second --- exists
                                first_blank_line = raw_content.index(/\n\s*\n/, raw_content.index('---') + 3)
                                first_blank_line ? raw_content[first_blank_line..-1] : raw_content
                              else
                                raw_content # Assume no front matter
                              end
          end
          # Assign the extracted markdown content (stripped of leading/trailing whitespace)
          # to a new variable in the post's data hash.
          post.data['raw_markdown'] = markdown_content.strip
        rescue StandardError => e
          Jekyll.logger.warn "RawContentGenerator:", "Could not read or process raw markdown for #{post.path}. Error: #{e.message}"
          post.data['raw_markdown'] = '' # Assign empty string on error
        end
      end
    end
  end
end