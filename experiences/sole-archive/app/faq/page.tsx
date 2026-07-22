import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { type FAQCategory, faqCategories } from "@/app/faq/faq-data";
import { AppLink } from "@/components/app-link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
	title: "FAQ - Store Template",
	description: "Frequently asked questions about orders, payments, shipping, returns, and more.",
};

function CategoryNav({ categories }: { categories: FAQCategory[] }) {
	return (
		<nav className="flex flex-wrap gap-2">
			{categories.map((category) => (
				<a
					key={category.id}
					href={`#${category.id}`}
					className="rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium text-foreground/60 transition-colors hover:border-foreground hover:bg-secondary hover:text-foreground"
				>
					{category.title}
				</a>
			))}
		</nav>
	);
}

function FAQSection({ category }: { category: FAQCategory }) {
	return (
		<section id={category.id} className="scroll-mt-24">
			<h2 className="mb-4 text-2xl font-bold uppercase">{category.title}</h2>
			<Accordion type="single" collapsible className="rounded-lg border border-foreground/15 px-4">
				{category.questions.map((item, index) => (
					<AccordionItem key={`${category.id}-${index}`} value={`${category.id}-${index}`}>
						<AccordionTrigger>{item.question}</AccordionTrigger>
						<AccordionContent>
							<p className="leading-relaxed text-foreground/65">{item.answer}</p>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</section>
	);
}

function ContactCard() {
	return (
		<div className="rounded-lg border border-foreground/15 bg-secondary/50 p-8 text-center">
			<h2 className="text-2xl font-bold uppercase">Still have questions?</h2>
			<p className="mt-2 text-foreground/65">
				We’re here to help. Reach out and we’ll get back to you as soon as possible.
			</p>
			<div className="mt-6 inline-flex items-center gap-2 text-sm font-medium">
				<Mail className="size-4" />
				<span>Contact us via the details on our website</span>
			</div>
		</div>
	);
}

export default function FAQPage() {
	return (
		<div className="store-container max-w-3xl py-12 sm:py-16">
			<div className="mb-10">
				<AppLink
					prefetch="eager"
					href="/"
					className="text-sm text-foreground/60 transition-colors hover:text-foreground"
				>
					Home
				</AppLink>
				<span className="mx-2 text-foreground/40">/</span>
				<span className="text-sm">FAQ</span>
				<h1 className="store-heading mt-4">Frequently Asked Questions</h1>
				<p className="mt-3 text-lg text-foreground/65">
					Find answers to the most common questions about your orders, payments, shipping, and more.
				</p>
			</div>

			<div className="mb-10">
				<CategoryNav categories={faqCategories} />
			</div>

			<div className="space-y-12">
				{faqCategories.map((category) => (
					<FAQSection key={category.id} category={category} />
				))}
			</div>

			<div className="mt-16">
				<ContactCard />
			</div>
		</div>
	);
}
