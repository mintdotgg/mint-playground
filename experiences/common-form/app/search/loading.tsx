export default function SearchLoading() {
	return (
		<section className="store-container store-section">
			<div className="mb-12">
				<div className="h-10 w-48 animate-pulse rounded bg-secondary" />
				<div className="mt-3 h-5 w-32 animate-pulse rounded bg-secondary" />
			</div>
			<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }, (_, i) => (
					<div key={i}>
						<div className="mb-4 aspect-[3/4] animate-pulse bg-secondary" />
						<div className="space-y-2">
							<div className="h-5 w-3/4 animate-pulse rounded bg-secondary" />
							<div className="h-5 w-1/4 animate-pulse rounded bg-secondary" />
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
