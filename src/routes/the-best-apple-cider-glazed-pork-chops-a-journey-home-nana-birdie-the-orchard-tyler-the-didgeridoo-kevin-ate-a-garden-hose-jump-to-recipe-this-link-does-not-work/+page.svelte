<script lang="ts">
	let nagOpen = $state(false);
	let nagShown = false;

	function onScroll() {
		if (nagShown) return;
		const progress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
		if (progress > 0.45) {
			nagShown = true;
			nagOpen = true;
		}
	}

	const loveReasons = [
		['They’re EASY!', '(Pork chops are pork chops.)'],
		['They’re COZY!', '(They are warm, because you cook them.)'],
		[
			'They’re FAMILY-FRIENDLY!',
			'(My kids refused to eat them but they looked at them, which is growth.)'
		],
		['They’re GLAZED!', 'Like a donut, but for dinner, and not a donut.'],
		[
			'They taste like AUTUMN!',
			'Specifically, the third week of autumn, around 4:47 PM, when the light hits the kitchen just right.'
		]
	];

	const photos = [
		'A single pork chop, soft-focus, on a wooden board I bought specifically for photos and have never cut on.',
		'The same pork chop, but I’ve placed a cinnamon stick near it, even though there is no cinnamon in this recipe.',
		'My hand, wearing a chunky ring, pouring cider from a vintage glass jug. The cider actually came out of a plastic jug. I decanted it for the photo.',
		'A blurry photo of Kevin the goat. He wandered in. I couldn’t bring myself to delete it.',
		'The finished dish, shot from directly above, next to a small pumpkin, a mini pumpkin, a gourd, a sprig of rosemary, three scattered cranberries, and a linen napkin arranged to look casual. It took 45 minutes. The pork was cold by the time we ate.',
		'Me, laughing at nothing, holding a fork near my face.'
	];

	const photoEmoji = ['🥩', '🥩🌰', '🧃', '🐐', '🎃', '😂'];

	const ingredients = [
		'4 pork chops, about 1 inch thick (patience not included)',
		'1.5 tsp salt, divided',
		'1/2 tsp black pepper',
		'3 Tbsp olive oil, divided',
		'1 cup apple cider (NOT VINEGAR, DIANE)',
		'1 Tbsp Dijon mustard',
		'1 Tbsp honey (Phil’s, ideally)',
		'2 garlic cloves, minced (I use 11, measure with your heart)',
		'1 Tbsp butter',
		'1.5 lb brussels sprouts, trimmed and halved (be gentle, they’ve been through a lot)',
		'1.5 cups jasmine rice',
		'2.25 cups water',
		'1 small decorative gourd (for photos only, do not eat)'
	];

	const instructions = [
		'Preheat the oven to 425°F. Pat the chops dry and season with most of the salt and the pepper. Take a moment. Breathe. Think of an orchard.',
		'Rinse the rice, bring to a boil with the water and a pinch of salt, cover, and cook on low 15 minutes. Turn off the heat and leave it covered. Don’t peek. Nana Birdie would know.',
		'Toss the brussels sprouts with 2 Tbsp oil and the rest of the salt. Roast cut-side down 20–25 minutes until browned. Tell them they’re doing great.',
		'Heat the remaining oil in a large skillet over medium-high. Sear the chops about 4 minutes per side, to 140°F. Move to a plate. Take a photo. Take eight more.',
		'Lower the heat to medium. Add garlic for 30 seconds, pour in the cider, and scrape up the browned bits. Whisk in the Dijon and honey and simmer about 6 minutes until syrupy. The kitchen will smell like my childhood. You’re welcome.',
		'Swirl in the butter, return the chops, and spoon glaze over them for a minute, until 145°F. Rest 3 minutes. Serve. Cry a little, if you need to.'
	];

	const comments = [
		{
			name: 'Karen M.',
			stars: 5,
			text: 'Haven’t made this yet but it looks delicious! Five stars!'
		},
		{ name: 'Diane R.', stars: 1, text: 'MY HOUSE' },
		{
			name: 'GrillDad_1974',
			stars: 3,
			text: 'I substituted the pork chops for ground turkey, the cider for Diet Sprite, and skipped the glaze. It was not good. Three stars.'
		},
		{ name: 'Tyler', stars: 2, text: 'meat should speak for itself' },
		{ name: 'Brent', stars: 5, text: 'So proud of you babe!!! Also, where are my keys' },
		{
			name: 'Nana Birdie',
			stars: 5,
			text: 'HOW DO I TURN THIS OFF',
			reply: 'Nana!!! 😭❤️ You’re on the internet!'
		},
		{ name: 'Kevin', stars: 5, text: 'maaaaaa' }
	];

	const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
</script>

<svelte:window onscroll={onScroll} />

<svelte:head>
	<title>🍂 The BEST Apple-Cider Glazed Pork Chops (A Journey Home) 🍂✨</title>
	<meta
		name="description"
		content="A cozy autumn recipe and also my entire life story. Jump to recipe (it doesn't work)."
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Lora:ital,wght@0,400;0,600;1,400&family=Playfair+Display:wght@700;900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="blog min-h-svh bg-[#fbf3e6] text-[#3b2a1e]">
	<!-- Fake blog chrome -->
	<header class="border-b-4 border-double border-[#c8763a] bg-[#fffaf2]">
		<div class="mx-auto max-w-3xl px-4 py-5 text-center">
			<p class="script text-4xl text-[#b5541f] sm:text-5xl">Cardigans &amp; Cider</p>
			<p class="mt-1 text-xs tracking-[0.3em] text-[#8a6a52] uppercase">
				a cozy little food blog · est. last fall
			</p>
			<nav
				class="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-[#8a6a52] underline decoration-dotted"
			>
				<span>Recipes</span><span>About Me (Long)</span><span>About Me (Longer)</span><span
					>Tyler Saga, Pt. 1–6</span
				><span>Shop My Cardigans</span>
			</nav>
		</div>
	</header>

	<div class="bg-[#3b2a1e] px-4 py-2 text-center text-xs text-[#fbf3e6]">
		🍂 FALL SALE: 12% off the cable-knit cardigan with code <strong>PORKLOVER</strong> 🍂
	</div>

	<main class="mx-auto max-w-3xl px-4 pb-24">
		<article class="prose-blog">
			<p class="mt-8 text-center text-sm text-[#8a6a52]">
				Home › Recipes › Autumn › Pork › Feelings
			</p>
			<h1 class="headline mt-3 text-center text-4xl leading-tight sm:text-5xl">
				🍂 The BEST Apple-Cider Glazed Pork Chops (A Journey Home) 🍂✨
			</h1>
			<p class="mt-3 text-center text-sm text-[#8a6a52]">
				Posted October 1 · Updated every time Nana calls · 47 min read
			</p>

			<div class="mt-6 text-center">
				<a
					href="#top"
					class="inline-block rounded-full bg-[#b5541f] px-6 py-3 font-semibold text-white shadow-md transition hover:bg-[#93421a]"
					onclick={(e) => e.preventDefault()}>⬇️ JUMP TO RECIPE</a
				>
				<p class="mt-1 text-sm italic text-[#8a6a52]">(this link does not work)</p>
			</div>

			<aside class="callout mt-8">
				📧 <strong>WAIT! Before you scroll!</strong> Join 47 of my closest readers and get my FREE
				e-book, <em>“Brussels Sprouts: A Love Language.”</em> Enter your email, your phone number,
				and your mother’s maiden name below!
				<form class="mt-3 flex flex-col gap-2 sm:flex-row" onsubmit={(e) => e.preventDefault()}>
					<input
						class="field"
						placeholder="Mother’s maiden name"
						aria-label="Mother’s maiden name"
					/>
					<button class="btn-rust" type="submit">GIVE ME THE SPROUTS</button>
				</form>
			</aside>

			<p class="mt-6 text-sm italic text-[#8a6a52]">
				This post may contain affiliate links. If you click them, I earn $0.003, which I will use to
				buy a single artisanal cinnamon stick.
			</p>

			<hr />

			<h2>A Crisp Autumn Morning, and a Whisper of Destiny</h2>
			<p>
				There’s a moment every year, usually around the third week of September, when I step onto my
				porch in my oversized cable-knit cardigan (<span class="aff">linked here</span>, 12% off
				with code PORKLOVER), clutch a mug of something steaming, and just <em>know</em>. The air
				shifts. The leaves begin their slow, golden surrender. Somewhere, a candle that smells like
				“Harvest Hearth” is being lit. And I whisper to no one in particular:
			</p>
			<p class="whisper">“It’s pork chop season.”</p>
			<p>
				But to understand these pork chops, you have to understand me. And to understand me, you
				have to understand my grandmother, Nana Birdie.
			</p>

			<h2>Nana Birdie and the Orchard</h2>
			<p>
				Nana Birdie lived in a little white farmhouse at the end of a gravel road so long that my
				father once ran out of gas on it twice in the same trip. Behind that farmhouse was an apple
				orchard. Forty-two trees. She had named every single one of them. There was Gerald. There
				was Big Susan. There was a small, sickly tree in the back she called “The Disappointment,”
				and she said that name with so much love.
			</p>
			<p>
				Every October, Nana Birdie would press cider in a hand-cranked press that had belonged to
				her mother, and her mother’s mother, and, according to family legend, a traveling salesman
				who left it behind in 1911 along with one boot. I would stand beside her on a milk crate,
				eight years old, turning the crank with both arms, and she would say:
			</p>
			<p class="whisper">“Honey, the secret to a good cider is patience.”</p>
			<p>
				I later learned the actual secret was that she was adding store-bought apple juice when
				nobody was looking. But the <em>spirit</em> of what she said remains true. Patience. Remember
				that word. It’s important. (It’s not important.)
			</p>

			<h2>The Wilderness Years</h2>
			<p>
				When I went off to college, I forgot about Nana Birdie’s orchard. I forgot about cider. I
				lived on ramen, regret, and a sophomore-year relationship with a man named Tyler who played
				the didgeridoo “semi-professionally.” I won’t get into the whole Tyler situation here (<span
					class="aff">Part 1 of 6 of that saga is linked in my sidebar</span
				>), but I will say this: Tyler did not believe in seasoning meat. Tyler believed meat should
				“speak for itself.”
			</p>
			<p>Tyler’s pork chops did not speak. They screamed. Silently. Into the void.</p>

			<h2>Coming Home</h2>
			<p>
				It wasn’t until years later, after I had married my wonderful husband Brent (hi babe! 👋),
				moved to the suburbs, and adopted three rescue goats named Parsley, Sage, and Kevin, that I
				found my way back to the kitchen. And it happened, as all great things happen, by accident.
			</p>
			<p>
				It was a Wednesday. It was raining. Kevin had eaten a garden hose. I was standing in front
				of my open refrigerator in the way that you do, hoping that dinner would simply occur, and
				there, on the second shelf, glowing like a beacon, was a jug of apple cider.
			</p>
			<p>And behind it? Four pork chops.</p>
			<p>I heard Nana Birdie’s voice. <em>“Patience.”</em></p>
			<p>
				I did not have patience. I had 40 minutes and a toddler who had discovered how to open the
				pantry. But I had her spirit. And that, friends, is where this recipe was born.
			</p>

			<h2>Why You’ll LOVE These Pork Chops</h2>
			<ul>
				{#each loveReasons as [bold, rest] (bold)}
					<li><strong>{bold}</strong> {rest}</li>
				{/each}
			</ul>

			<aside class="callout callout-red">
				🛑 <strong>Did you know?</strong> Pinning this recipe on Pinterest helps small creators like me
				afford my 14 different pumpkin-scented candles! Pin it now! Pin it again! I cannot see you pinning
				it but I’ll know.
			</aside>

			<h2>What IS a Pork Chop?</h2>
			<p>
				Great question that nobody asked! A pork chop is a cut of meat that comes from a pig. Pigs
				are animals. They live on farms. Farms are places where things grow. Things that grow
				include apples, which, as we discussed, are very important to my grandmother. See how it all
				connects? Food is really just a big circle. Like a glazed pork chop. Which is not a circle.
			</p>
			<p>
				The word “chop” comes from the Old English word <em>“choppe,”</em> which I made up just now, but
				I’m confident about it.
			</p>

			<h2>Ingredient Notes (Please Read Before Commenting)</h2>
			<p>
				<strong>Pork chops:</strong> I like mine about an inch thick. Brent likes his “however they come.”
				Brent is wrong, but I love him.
			</p>
			<p>
				<strong>Apple cider:</strong> NOT apple cider vinegar. I cannot stress this enough. Last year
				a reader named Diane used a full cup of apple cider vinegar and left me a one-star review that
				just said “MY HOUSE.” Diane, I’m so sorry. But also, Diane.
			</p>
			<p>
				<strong>Dijon mustard:</strong> Adds tang! If you don’t have Dijon, you can use yellow mustard,
				though Nana Birdie would roll over in her grave (she’s alive, she just sleeps in a lot).
			</p>
			<p>
				<strong>Honey:</strong> I use local honey from my neighbor Phil’s backyard hives. Phil is a fascinating
				man who has been stung 900 times and no longer feels emotions. You can use any honey.
			</p>
			<p>
				<strong>Brussels sprouts:</strong> Look, I know. Brussels sprouts had a rough childhood. We all
				did. Give them a chance. Roast them. Love them. They’re just tiny cabbages who want to be seen.
			</p>

			<h2>Substitutions (Readers ALWAYS Ask!)</h2>
			<p>
				<strong>Can I make this without pork?</strong> Then it’s just apple-cider glaze on a plate. Which,
				honestly? Valid.
			</p>
			<p>
				<strong>Can I use chicken?</strong> Sure! Then it’s a different recipe that I haven’t written.
				Check back in 2029.
			</p>
			<p>
				<strong>Can I make this vegan?</strong> Absolutely! Replace the pork with tofu, the butter with
				vegan butter, the honey with maple syrup, and the chicken stock (there is no chicken stock) with
				vegetable stock. Then it’s a totally different dish, and I will not be taking questions.
			</p>
			<p>
				<strong>Can I make this in an air fryer?</strong> Everything can be made in an air fryer if you
				believe hard enough.
			</p>
			<p><strong>Can I skip the brussels sprouts?</strong> You can, but they’ll know.</p>

			<h2>A Quick Word From Our Sponsor</h2>
			<aside class="ad">
				<span class="ad-label">Advertisement</span>
				🔪
				<em
					>This recipe is brought to you by ChopMaster 9000, the only knife that remembers your
					birthday. Use code NANABIRDIE for free shipping on orders over $400.</em
				>
			</aside>

			<h2>Step-by-Step Photos</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each photos as caption, i (caption)}
					<figure class="photo">
						<div class="photo-img" aria-hidden="true">{photoEmoji[i]}</div>
						<figcaption>Photo {i + 1}: {caption}</figcaption>
					</figure>
				{/each}
			</div>

			<h2>Okay, Almost to the Recipe!</h2>
			<p>
				Before we get there, I just want to say: thank you. Thank you for being here. Thank you for
				scrolling. Thank you for scrolling some more. Thank you for scrolling past the part about
				Tyler. Cooking isn’t just about food. It’s about memory. It’s about family. It’s about
				standing on a milk crate next to a woman who named a tree “The Disappointment” and meant it
				lovingly.
			</p>
			<p>
				Nana Birdie, if you’re reading this (she isn’t; she thinks the internet is “a fad”), this
				one’s for you.
			</p>

			<aside class="callout">
				📧 <strong>Leaving so soon?!</strong> Sign up for my newsletter! No? Are you SURE? Click “No thanks,
				I don’t like delicious food and I hate my grandmother” to continue.
			</aside>

			<hr />

			<!-- The Actual Recipe -->
			<section id="recipe" class="recipe-card">
				<h2 class="headline mt-0! text-center text-3xl">🍎 The Actual Recipe</h2>
				<dl class="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
					<div class="col-span-2 sm:col-span-3">
						<dt>Serves</dt>
						<dd>
							4 (or 2 adults and a toddler who will eat three bites of rice and one brussels sprout
							leaf)
						</dd>
					</div>
					<div>
						<dt>Prep time</dt>
						<dd>10 minutes</dd>
					</div>
					<div>
						<dt>Cook time</dt>
						<dd>30 minutes</dd>
					</div>
					<div>
						<dt>Emotional prep</dt>
						<dd>12 years</dd>
					</div>
					<div class="col-span-2 sm:col-span-3">
						<dt>Total time</dt>
						<dd>However long it took you to scroll here</dd>
					</div>
				</dl>

				<h3>Ingredients</h3>
				<ul class="checklist">
					{#each ingredients as item (item)}
						<li>
							<label><input type="checkbox" /> <span>{item}</span></label>
						</li>
					{/each}
				</ul>

				<h3>Instructions</h3>
				<ol>
					{#each instructions as step (step)}
						<li>{step}</li>
					{/each}
				</ol>

				<h3>Nutrition</h3>
				<p class="mb-0!">Calories: yes<br />Love: 100% DV</p>
			</section>

			<hr />

			<h2>💬 Comments (312)</h2>
			<ul class="comments">
				{#each comments as c (c.name)}
					<li>
						<p>
							<strong>{c.name}</strong>
							<span class="text-[#d9932b]" aria-label="{c.stars} out of 5 stars"
								>{stars(c.stars)}</span
							>
						</p>
						<p class="mt-1">{c.text}</p>
						{#if c.reply}
							<div class="reply">
								↳ <strong>Author reply:</strong>
								{c.reply}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
			<button class="btn-rust mt-4 w-full opacity-60" type="button" disabled>
				Load 305 more comments
			</button>
		</article>
	</main>

	{#if nagOpen}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="nag-title"
		>
			<div
				class="max-w-md rounded-2xl border-4 border-[#c8763a] bg-[#fffaf2] p-6 text-center shadow-2xl"
			>
				<p class="text-5xl">🍂🥺🍂</p>
				<h2 id="nag-title" class="headline mt-2 text-2xl">Leaving so soon?!</h2>
				<p class="mt-2">
					Sign up for my newsletter and never miss a single word about my goats, my grandmother, or
					my cardigans!
				</p>
				<input class="field mt-4 w-full" placeholder="you@email.com" aria-label="Email" />
				<button class="btn-rust mt-3 w-full" type="button" onclick={() => (nagOpen = false)}>
					YES! Feed me stories! 🍁
				</button>
				<button
					class="mt-3 text-xs text-[#8a6a52] underline"
					type="button"
					onclick={() => (nagOpen = false)}
				>
					No thanks, I don’t like delicious food and I hate my grandmother
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.blog {
		font-family: 'Lora', Georgia, serif;
		font-size: 1.075rem;
		line-height: 1.8;
	}
	.headline,
	.prose-blog :global(h2),
	.prose-blog :global(h3) {
		font-family: 'Playfair Display', Georgia, serif;
		color: #6e2f12;
	}
	.headline {
		font-weight: 900;
	}
	.script {
		font-family: 'Dancing Script', cursive;
	}
	.prose-blog :global(h2) {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.25;
		margin-top: 2.5rem;
		margin-bottom: 0.75rem;
	}
	.prose-blog :global(h3) {
		font-size: 1.25rem;
		font-weight: 700;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}
	.prose-blog :global(p) {
		margin-bottom: 1rem;
	}
	.prose-blog :global(ul),
	.prose-blog :global(ol) {
		padding-left: 1.5rem;
		margin-bottom: 1rem;
	}
	.prose-blog :global(ul) {
		list-style: '🍂 ';
	}
	.prose-blog :global(ol) {
		list-style: decimal;
	}
	.prose-blog :global(li) {
		margin-bottom: 0.4rem;
	}
	.prose-blog :global(hr) {
		border: 0;
		height: 1.5rem;
		margin: 2.5rem 0;
		text-align: center;
	}
	.prose-blog :global(hr)::after {
		content: '🍁 🍂 🍁';
		display: block;
		text-align: center;
	}
	.whisper {
		font-family: 'Dancing Script', cursive;
		font-size: 1.9rem;
		text-align: center;
		color: #b5541f;
		margin: 1.5rem 0;
	}
	.aff {
		color: #b5541f;
		text-decoration: underline wavy #d9932b;
		cursor: pointer;
	}
	.callout {
		background: #fff1d6;
		border: 2px dashed #d9932b;
		border-radius: 1rem;
		padding: 1rem 1.25rem;
		margin: 1.5rem 0;
	}
	.callout-red {
		background: #fde4dc;
		border-color: #c8443a;
	}
	.ad {
		display: block;
		position: relative;
		background: repeating-linear-gradient(45deg, #fff, #fff 10px, #f6efe3 10px, #f6efe3 20px);
		border: 1px solid #d8c7b0;
		padding: 1.75rem 1.25rem 1.25rem;
		margin: 1rem 0 1.5rem;
		text-align: center;
	}
	.ad-label {
		position: absolute;
		top: 0.3rem;
		left: 0.6rem;
		font-size: 0.65rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: #8a6a52;
	}
	.photo {
		background: #fffaf2;
		border: 1px solid #ead9c1;
		border-radius: 0.75rem;
		padding: 0.75rem;
		box-shadow: 0 4px 12px rgb(110 47 18 / 0.08);
	}
	.photo-img {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 4 / 3;
		font-size: 3.5rem;
		border-radius: 0.5rem;
		background: radial-gradient(circle at 30% 30%, #f7d9a8, #c8763a 120%);
		filter: blur(0.4px) saturate(1.2);
	}
	.photo figcaption {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		font-style: italic;
		line-height: 1.5;
		color: #6b5040;
	}
	.recipe-card {
		background: #fffaf2;
		border: 3px solid #c8763a;
		border-radius: 1.25rem;
		padding: 1.5rem;
		box-shadow: 0 10px 30px rgb(110 47 18 / 0.12);
	}
	.recipe-card dt {
		font-size: 0.7rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: #8a6a52;
	}
	.recipe-card dd {
		font-weight: 600;
		line-height: 1.4;
	}
	.checklist {
		list-style: none !important;
		padding-left: 0 !important;
	}
	.checklist label {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		cursor: pointer;
	}
	.checklist input {
		accent-color: #b5541f;
	}
	.checklist input:checked + span {
		text-decoration: line-through;
		opacity: 0.6;
	}
	.comments {
		list-style: none !important;
		padding-left: 0 !important;
	}
	.comments li {
		background: #fffaf2;
		border: 1px solid #ead9c1;
		border-radius: 0.75rem;
		padding: 0.9rem 1.1rem;
		margin-bottom: 0.75rem;
	}
	.comments li p {
		margin-bottom: 0;
	}
	.reply {
		margin-top: 0.6rem;
		margin-left: 1rem;
		padding-left: 0.75rem;
		border-left: 3px solid #d9932b;
		font-size: 0.95rem;
	}
	.field {
		flex: 1;
		border: 2px solid #ead9c1;
		border-radius: 0.6rem;
		background: #fff;
		padding: 0.5rem 0.75rem;
	}
	.btn-rust {
		background: #b5541f;
		color: #fff;
		font-weight: 600;
		border-radius: 0.6rem;
		padding: 0.55rem 1rem;
	}
	.btn-rust:not(:disabled):hover {
		background: #93421a;
	}
</style>
