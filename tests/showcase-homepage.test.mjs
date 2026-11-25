import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const planSource = fs.readFileSync(path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "lib", "membership-plans.ts"), "utf8");
const planExports = {};
vm.runInNewContext(ts.transpileModule(planSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: planExports, Intl });

function loadPage(relativePath, user = null, overrides = {}, globals = {}) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const source = fs.readFileSync(path.join(root, ...relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/image": { default: () => null },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/app/actions/auth": { logoutAction: () => {} },
    "@/lib/membership-plans": planExports,
    "./weekly-moment-makers": { default: () => null },
    "./first-message": { default: () => null },
    "./protected-moment": { default: () => null },
    ...overrides,
  };
  vm.runInNewContext(compiled, {
    exports,
    ...globals,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports.default;
}

function renderPage(relativePath) {
  return renderToStaticMarkup(React.createElement(loadPage(relativePath)));
}

async function renderSuspendedActions(container) {
  const suspense = React.Children.toArray(container.props.children)
    .find((child) => React.isValidElement(child) && child.type === React.Suspense);
  assert.ok(suspense);
  return renderToStaticMarkup(await suspense.props.children.type());
}

test("homepage hero preserves guest actions and removes the signed-in duplicate", async () => {
  const renderHero = async (user) => {
    const page = loadPage(["app", "page.tsx"], user);
    return renderSuspendedActions(page().props.children[0]);
  };
  const guest = await renderHero(null);
  assert.match(guest, /href="\/signup"[^>]*>Create Your Legacy<\/a>/);
  assert.match(guest, /href="\/search"[^>]*>Find A Moment Maker<\/a>/);
  const signedIn = await renderHero({ id: "viewer" });
  assert.doesNotMatch(signedIn, /My Legacy|href="\/dashboard"|Create Your Legacy/);
  assert.match(signedIn, /href="\/search"[^>]*bg-\[#D8A35B\][^>]*>Find A Moment Maker<\/a>/);
});

test("signed-in primary navigation retains My Legacy and Sign Out", async () => {
  const navigation = loadPage(["app", "site-navigation.tsx"], { id: "viewer" });
  const html = await renderSuspendedActions(navigation().props.children);
  assert.equal((html.match(/href="\/dashboard"[^>]*>My Legacy<\/a>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /href="\/help"/);
  assert.equal((html.match(/type="submit"[^>]*>Sign Out<\/button>/g) ?? []).length, 2);
  assert.match(html, /<summary[^>]*>Menu<\/summary>/);
});

test("signed-in navigation matches the brand typography on desktop and mobile", async () => {
  const navigation = loadPage(["app", "site-navigation.tsx"], { id: "viewer" });
  const container = navigation().props.children;
  const brandClasses = container.props.children[0].props.className.split(" ");
  const html = await renderSuspendedActions(container);
  const controls = [...html.matchAll(/<(?:a|button)\b[^>]*class="([^"]+)"[^>]*>(?:My Legacy|Sign Out)<\/(?:a|button)>/g)];
  assert.equal(controls.length, 4);
  for (const [, classes] of controls) {
    for (const typographyClass of ["font-serif", "font-normal", "text-base", "sm:text-lg", "items-center"]) {
      assert.ok(brandClasses.includes(typographyClass));
      assert.ok(classes.split(" ").includes(typographyClass));
    }
    assert.ok(!classes.split(" ").includes("text-sm"));
    assert.ok(!classes.split(" ").includes("font-medium"));
  }
});

test("guest primary navigation retains desktop and mobile account links", async () => {
  const navigation = loadPage(["app", "site-navigation.tsx"]);
  const container = navigation().props.children;
  const brandClasses = container.props.children[0].props.className.split(" ");
  const html = await renderSuspendedActions(container);
  assert.equal((html.match(/href="\/signup"[^>]*>Create Your Legacy<\/a>/g) ?? []).length, 2);
  assert.equal((html.match(/href="\/login"[^>]*>Sign In<\/a>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /href="\/help"/);
  assert.match(html, /<summary[^>]*>Menu<\/summary>/);
  const controls = [...html.matchAll(/<a\b[^>]*class="([^"]+)"[^>]*>(?:Create Your Legacy|Sign In)<\/a>/g)];
  assert.equal(controls.length, 4);
  for (const [, classes] of controls) {
    for (const typographyClass of ["font-serif", "font-normal", "text-base", "sm:text-lg", "items-center"]) {
      assert.ok(brandClasses.includes(typographyClass));
      assert.ok(classes.split(" ").includes(typographyClass));
    }
    assert.ok(!classes.split(" ").includes("font-medium"));
    assert.ok(!classes.split(" ").includes("text-sm"));
  }
  assert.match(html, /<summary[^>]*class="[^"]*font-medium[^"]*text-sm[^"]*"[^>]*>Menu<\/summary>/);
});

test("the shared layout provides Help Center in footer navigation", () => {
  const layout = loadPage(["app", "layout.tsx"], null, {
    "next/font/google": { Geist: () => ({ variable: "sans" }), Geist_Mono: () => ({ variable: "mono" }) },
    "./site-navigation": { default: () => null },
    "./site-visit-tracker": { default: () => null },
    "./globals.css": {},
  });
  const html = renderToStaticMarkup(React.createElement(layout, null, React.createElement("main", null, "Page content")));
  assert.match(html, /<main>Page content<\/main>[\s\S]*<footer[^>]*><nav aria-label="Footer navigation"[^>]*><a href="\/pricing"[^>]*>Plans &amp; Pricing<\/a>[\s\S]*<a href="\/help"[^>]*>Help Center<\/a>/);
});

test("Help Center presents current guides, limitations and support contact", () => {
  const html = renderPage(["app", "help", "page.tsx"]);
  for (const id of ["getting-started", "connected-lives", "legacy-tree", "honored-lives", "creating-moments", "photos-videos", "moments-in-the-making", "membership", "support", "ideas"]) {
    assert.match(html, new RegExp(`<section id="${id}"`));
    assert.match(html, new RegExp(`href="#${id}"`));
  }
  assert.equal((html.match(/Screenshot Coming Soon:/g) ?? []).length, 7);
  assert.match(html, /<details/);
  assert.match(html, /Searchable Only or Public/);
  assert.match(html, /Placeholders are not accounts/);
  assert.match(html, /not video uploads or contributor permissions/);
  assert.match(html, /MP4, MOV, or M4V video up to 100 MiB/);
  assert.match(html, /Free Legacy is the only membership available for new accounts/);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /href="mailto:NeverSayGoodbye.life@yahoo.com"/);
  assert.match(html, /href="\/forgot-password"/);
});

test("pricing displays the requested roadmap without implying paid access or delivery is available", () => {
  const html = renderPage(["app", "pricing", "page.tsx"]);
  for (const text of [
    "Free Legacy", "Free Forever", "Legacy Plus", "$4.99/month", "Family Legacy", "$7.99/month",
    "Most Popular", "Legacy Forever", "$299 One-Time", "3 Public Videos", "2 Private Videos",
    "25 Photos", "10 Stories", "5 Voice Messages", "2 Cannot Open Until™ Messages",
    "50 total videos", "50 voice messages", "25 Cannot Open Until™ Messages",
    "Up to 5 family profiles", "250 videos", "Up to 10 family profiles", "1,000 videos",
    "Never Forget™ Family Calendar", "Legacy Vault Export", "Digital Executor Designation",
  ]) assert.ok(html.includes(text), text);
  assert.match(html, /plan limits are not enforced/);
  assert.match(html, /paid plans and billing are coming soon/);
  for (const text of ["Automatic reminders", "Birthday video delivery", "Anniversary message delivery", "Custom milestone scheduling", "Scheduled message delivery", "Unlimited future deliveries", "Legacy Vault Export"]) {
    assert.ok(html.includes(`${text}<span class="text-slate-400"> (Coming Soon)</span>`), text);
  }
  assert.match(html, /Shared family dates/);
  assert.match(html, /href="\/signup"[^>]*>Create a Free Account/);
  assert.equal((html.match(/Create a Free Account/g) ?? []).length, 1);
  const [free, plus, family, forever] = planExports.membershipPlans;
  assert.deepEqual(JSON.parse(JSON.stringify([free.limits, plus.limits, family.limits, forever.limits])), [
    { profiles: 1, videos: { public: 3, private: 2 }, photos: 25, stories: 10, voiceMessages: 5, cannotOpenUntilMessages: 2 },
    { videos: { total: 50 }, photos: null, stories: null, voiceMessages: 50, cannotOpenUntilMessages: 25 },
    { profiles: 5, videos: { total: 250 }, photos: null, stories: null, voiceMessages: null, futureDeliveries: null },
    { profiles: 10, videos: { total: 1000 }, futureDeliveries: null },
  ]);
});

test("signup lists all roadmap plans but allows only Free Legacy", () => {
  const Signup = loadPage(["app", "signup", "signup-form.tsx"], null, {
    react: {
      ...React,
      useActionState: () => [{}, () => {}, false],
      useState: (initial) => [initial, () => {}],
    },
    "@/app/actions/auth": { signupAction: () => {} },
    "@/app/searchability-warning": { default: () => null },
  });
  const html = renderToStaticMarkup(React.createElement(Signup));
  assert.match(html, /href="\/pricing"/);
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((match) => match[0]);
  const free = inputs.find((input) => input.includes('name="membership"') && input.includes('value="free"'));
  assert.ok(free);
  assert.match(free, /checked=""/);
  assert.doesNotMatch(free, /disabled=""/);
  for (const id of ["legacy-plus", "family-legacy", "legacy-forever"]) {
    const input = inputs.find((item) => item.includes('name="membership"') && item.includes(`value="${id}"`));
    assert.ok(input, id);
    assert.match(input, /disabled=""/);
  }
  assert.match(html, /plan limits are not enforced/);
});

test("the homepage showcase link opens John's profile without the message fragment", () => {
  const html = renderPage(["app", "page.tsx"]);
  assert.match(html, /<a href="\/profile-preview"[^>]*>See Sample Profile<\/a>/);
  assert.doesNotMatch(html, /profile-preview#first-message/);
});

test("How It Works keeps its existing cards and adds Stop Making Notes", () => {
  const html = renderPage(["app", "page.tsx"]);
  const section = html.match(/<section\b[^>]*>[\s\S]*?<\/section>/g)
    ?.find((item) => item.includes("How It Works"));
  assert.ok(section);
  const cards = [...section.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(([card]) => card);
  assert.equal(cards.length, 6);
  for (const [index, title] of [
    "Record Your Story", "Leave Messages", "Protect Private Memories", "Deliver Comfort",
  ].entries()) {
    assert.ok(cards[index].includes(title));
  }
  assert.match(cards[4], /❤️ Connected, Even When You&#x27;re Not/);
  assert.match(cards[4], /<p[^>]*>Schedules, school, time zones, and responsibilities make conversations difficult\.<\/p><p[^>]*>Life gets busy\.<\/p><p[^>]*>Family shouldn&#x27;t have to wait\.<\/p>/);
  assert.match(cards[5], />06<\/span>/);
  assert.match(cards[5], /🎂 Stop Making Notes/);
  assert.match(cards[5], /Birthdays, anniversaries, and milestones are important, but shouldn&#x27;t be another thing to remember\./);
  assert.match(cards[5], /Never Say Goodbye helps you remember the moments that matter\./);
});

test("homepage feature cards explain each feature and retain their links", () => {
  const html = renderPage(["app", "page.tsx"]);
  const section = html.match(/<section id="features"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  const cards = [...section.matchAll(/<a href="([^"]+)"[^>]*><h3[^>]*>([^<]+)<\/h3><p[^>]*>([^<]+)<\/p><\/a>/g)];
  assert.deepEqual(cards.map(([, href, title, description]) => [href, title, description]), [
    ["/connected-lives", "Connected Lives™", "Build meaningful connections with family, friends, mentors, and the people who matter most."],
    ["/legacy-tree", "Legacy Tree™", "Preserve family relationships across generations and keep your story connected."],
    ["/future-moment-maker", "Future Moment Makers™", "Create moments today for children, grandchildren, and family members whose stories are still unfolding."],
    ["/create-moment/cannot-open-until", "Cannot Open Until™", "Deliver memories, letters, photos, videos, and messages on a future date or life milestone."],
  ]);
});

test("Cannot Open Until creation route requires authentication and opens the correct editor", async () => {
  const editor = () => null;
  const route = ["app", "create-moment", "cannot-open-until", "page.tsx"];
  const authenticatedPage = loadPage(route, null, {
    "@/lib/auth": { requireUser: async () => ({ id: "viewer" }) },
    "../moment-editor": { default: editor },
  });
  const element = await authenticatedPage();
  assert.equal(element.type, editor);
  assert.equal(element.props.kind, "cannot-open-until");

  const guestPage = loadPage(route, null, {
    "@/lib/auth": { requireUser: async () => { throw new Error("redirect to login"); } },
    "../moment-editor": { default: editor },
  });
  await assert.rejects(guestPage(), /redirect to login/);
});

test("homepage and showcase footers link the site name to the homepage", () => {
  for (const relativePath of [["app", "page.tsx"], ["app", "profile-preview", "page.tsx"]]) {
    const html = renderPage(relativePath);
    assert.match(html, /<footer\b[^>]*>[\s\S]*?<a href="\/"[^>]*>Never Say Goodbye<\/a>[\s\S]*?<\/footer>/);
  }
});

test("the showcase tree link targets John's tree, not the viewer's tree", () => {
  const html = renderPage(["app", "profile-preview", "page.tsx"]);
  assert.match(html, /<a href="\/profile-preview#family-tree-heading"[^>]*>🌳 View Legacy Tree™<\/a>/);
  assert.match(html, /<h2 id="family-tree-heading"[^>]*>John&#x27;s Legacy Tree™<\/h2>/);
  assert.doesNotMatch(html, /href="\/legacy-tree(?:[?#][^"]*)?"/);
});

test("showcase labels fictional tree and visited profiles", () => {
  const html = renderPage(["app", "profile-preview", "page.tsx"]);
  assert.match(html, /Illustrative example: actual Legacy Trees show membership, not inferred generations/);
  assert.match(html, />Frequently Visited<\/h2>/);
  assert.match(html, /A fictional example of a shortcut/);
  assert.doesNotMatch(html, /Most Visited/);
});

test("showcase distinguishes future profiles and links only Debbie's example", () => {
  const html = renderPage(["app", "profile-preview", "page.tsx"]);
  const section = html.match(/<section aria-labelledby="future-makers-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section, /These fictional profiles illustrate reserved places/);
  assert.match(section, /Only Debbie&#x27;s example has a detail page/);
  for (const name of ["A Future Grandchild", "Another Future Grandchild", "Future Godchild"]) {
    assert.match(section, new RegExp(`>${name}</p>`));
  }
  assert.doesNotMatch(section, /Future Grandchild [12]/);
  assert.match(section, /href="\/future-moment-maker"[^>]*>Explore Debbie&#x27;s example<\/a>/);
  assert.equal((section.match(/<a\b/g) ?? []).length, 1);
});

test("Debbie's example is labeled fictional and links back to John's showcase", () => {
  const html = renderPage(["app", "future-moment-maker", "page.tsx"]);
  assert.match(html, /Fictional example profile/);
  assert.match(html, /href="\/profile-preview#future-makers-heading"[^>]*>Return to John&#x27;s showcase<\/a>/);
  assert.match(html, /add one to a Legacy Tree™ or create one while publishing a Future Moment Maker™ moment/);
  assert.doesNotMatch(html, /When a Moment Maker creates a Cannot Open Until/);
  assert.match(html, /href="\/james-doe"[^>]*>James Michael Doe<\/a>/);
});

test("family traditions displays a local, described image instead of a placeholder", () => {
  const page = loadPage(
    ["app", "profile-preview", "page.tsx"],
    null,
    { "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) } },
  );
  const html = renderToStaticMarkup(React.createElement(page));
  const card = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g)
    ?.find((article) => article.includes("Family Traditions I Carry On"));
  assert.ok(card);
  assert.match(card, /src="\/images\/family-traditions\.jpg"/);
  assert.match(card, /alt="An illustrative photo of a multigenerational family sharing a meal at a table"/);
  assert.doesNotMatch(card, /Photo coming soon/);
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  assert.ok(fs.statSync(path.join(root, "public", "images", "family-traditions.jpg")).size > 0);
});

test("first message does not advertise a duration without a recording", () => {
  const html = renderPage(["app", "profile-preview", "first-message.tsx"]);
  assert.match(html, /This example does not have a recording yet/);
  assert.doesNotMatch(html, /Duration:/);
});

test("Escape closes a protected moment and clears its entered code and error", () => {
  const state = [true, "wrong", true, false];
  let stateIndex = 0;
  let listener;
  let cleanup;
  const window = {
    addEventListener(type, handler) {
      assert.equal(type, "keydown");
      listener = handler;
    },
    removeEventListener(type, handler) {
      assert.equal(type, "keydown");
      assert.equal(handler, listener);
      listener = undefined;
    },
  };
  const hooks = {
    useState() {
      const index = stateIndex++;
      return [state[index], (value) => { state[index] = value; }];
    },
    useCallback(callback) { return callback; },
    useEffect(effect) { cleanup = effect(); },
  };
  const component = loadPage(
    ["app", "profile-preview", "protected-moment.tsx"],
    null,
    { react: hooks },
    { window },
  );
  component({ title: "Example" });
  listener({ key: "Enter" });
  assert.deepEqual(state, [true, "wrong", true, false]);
  listener({ key: "Escape" });
  assert.deepEqual(state, [false, "", false, false]);
  cleanup();
  assert.equal(listener, undefined);
});
