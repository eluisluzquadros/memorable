// The best writer changes with the content type (EXP-308), so an account may pick one writer per format
// (modelRoles.writerByFormat) and keep the general writer for formats without a choice.
export const writerFor = (roles = {}, format) => (format && roles.writerByFormat?.[format]) || roles.writer;

// The writer of every format that has the given lab profile (essencial, equilibrado, excelencia). Formats
// where no model reached the quality floor are left out, so they keep the general writer.
export function profileWriters(byFormat = {}, profile, available = () => true) {
  return Object.fromEntries(Object.entries(byFormat)
    .map(([format, summary]) => [format, summary?.profiles?.redator?.[profile]])
    .filter(([, model]) => model && available(model)));
}
