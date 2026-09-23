import { motion } from "framer-motion";

export function ChatResponseLoader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="w-fit bg-[var(--paper)] px-4 py-3 shadow-[inset_3px_0_0_var(--purple)]"
      role="status"
      aria-label="NotesRAG is searching your notes"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--purple)]">Searching your notes</p>
      <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="size-1.5 rounded-full bg-[var(--purple)]"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 0.72, delay: index * 0.12, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}
