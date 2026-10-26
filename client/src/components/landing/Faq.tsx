import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EASE } from "@/lib/motion";

// Every answer matches how the product behaves (see backend attendancecron.ts,
// the workspace task window and the member-invite flow).
const QUESTIONS = [
  {
    q: "Does my team still need to clock in?",
    a: "No. Attendance comes from the tasks people plan and finish each day. There's nothing to punch in or out of.",
  },
  {
    q: "When is a day's attendance decided?",
    a: "Finishing your whole list marks you present straight away. Whatever is left is settled at 9:00 PM India time: some tasks done counts as partial, and no tasks planned counts as absent.",
  },
  {
    q: "Can I control when people add their plans?",
    a: "Yes. Set submission hours for a workspace, say 9 to 11 in the morning, or leave it open so people add tasks any time. Tasks an admin or lead assigns are never blocked.",
  },
  {
    q: "What do the people I add receive?",
    a: "An email with their sign-in details and a link to confirm their address. They choose their own password the first time they sign in, or use Google instead.",
  },
  {
    q: "Who can see what?",
    a: "Admins see the whole organisation. A project or team lead sees what they lead and can assign work there. Everyone else sees their own tasks and attendance.",
  },
  {
    q: "Can I get the numbers out?",
    a: "Yes. Reports cover any person, team or project over a date range you pick, and export to CSV for payroll or your accountant.",
  },
];

/** Plain answers to what a small-business owner asks first. */
export const Faq = () => (
  <section id="faq" className="scroll-mt-16">
    <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="text-[34px] leading-[1.08] tracking-[-0.03em] sm:text-[48px]">Questions, answered</h2>
        <p className="mt-4 max-w-[36ch] text-lg leading-relaxed text-muted-foreground">
          The things owners ask before they move their team over.
        </p>
      </div>
      <motion.div
        initial={{ opacity: 0, transform: "translateY(12px)" }}
        whileInView={{ opacity: 1, transform: "translateY(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <Accordion type="single" collapsible defaultValue="q0" className="border-t border-border/80">
          {QUESTIONS.map((item, i) => (
            <AccordionItem key={item.q} value={`q${i}`} className="border-border/80">
              <AccordionTrigger className="py-5 text-left text-[17px] font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </div>
  </section>
);
