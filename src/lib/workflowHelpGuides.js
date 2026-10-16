// Built-in instructions for user-facing flows. Keep these in sync with UI changes.
// Available offline from the bundle and visible even if HelpArticle API is unavailable.
const updated = "2026-10-16";
const guides = [
  {
    slug: "choose-light-or-dark-mode", category: "Account & Security",
    question: "How do I make IFund light or dark?",
    description: "Change the whole screen, not just the menu.",
    answer: `1. Open IFund.
2. Tap the sun or moon button at the top, or in the side menu on a computer.
3. Light makes the page bright. Dark makes the page dark.
4. Your choice stays saved for next time.
5. The pages, boxes, words, and menus should all change. If a page does not change, tell us which page it is.
Updated: ${updated}.`,
    keywords: ["theme", "appearance", "dark", "light", "accessibility"]
  },
  {
    slug: "make-a-campaign-with-ai-ideas", category: "Campaigns",
    question: "How do I make a campaign with AI help?",
    description: "Pick from five titles, then five descriptions, then create your story.",
    answer: `1. Tap New Campaign.
2. Tell IFund what you want to do and who it helps. You can skip the extra questions.
3. Tap Continue. Choose a kind of campaign and the amount you want to raise.
4. Tap Continue. Type a title, OR tap Show five AI options. Tap the one you like.
5. Type one line about your campaign, OR tap Show five AI options. Tap the one you like.
6. Tap Forge my story. The story appears in the box below. You can edit it yourself.
7. Add a picture, then tap Continue and read everything.
8. Tap Launch campaign to publish, or Save draft to finish later.

You never need to type the same answer twice. AI suggestions only work when AI help is available. You can always use your own words.
Updated: ${updated}.`,
    keywords: ["ai", "campaign", "title", "five options", "story", "summary"]
  },
  {
    slug: "pay-with-paypal-on-a-phone", category: "Donations",
    question: "How do I donate with PayPal on my phone?",
    description: "Find the PayPal button and see the payment choices.",
    answer: `1. Open a campaign and tap Donate.
2. Type how much you want to give. The number is the whole gift to that campaign.
3. If you want, turn on the extra support for IFund. It is off at first.
4. Read the total. If PayPal is ready for this campaign, scroll down to Give with PayPal.
5. Tap the PayPal button. Follow PayPal's safe checkout steps.
6. Come back to IFund to see your result. If payment did not finish, do not try to count it as paid.

If you cannot see the button, scroll inside the donation window. It should fit your phone. If PayPal is not available, no PayPal payment begins.
Updated: ${updated}.`,
    keywords: ["donate", "paypal", "phone", "checkout", "button", "cropped"]
  },
  {
    slug: "crypto-wallet-donations", category: "Donations",
    question: "Can I give or get cryptocurrency?",
    description: "Crypto receiving is being prepared. It is not a live payment option yet.",
    answer: `1. Open your campaign settings.
2. Turn on Allow cryptocurrency donations if you want it when it is ready.
3. Save. This only saves your choice. It does not create a wallet or receive money yet.
4. Google Wallet and Google Pay do not provide a cryptocurrency receiving address.
5. Do not send coins to a random address or an address that does not match the coin and network.
6. Wait for IFund to clearly show that crypto receiving has been checked and is ready.

A connected wallet alone does not mean a payment was sent. No crypto gifts count toward your campaign until a real transaction is verified.
Updated: ${updated}.`,
    keywords: ["crypto", "wallet", "google", "bitcoin", "paypal", "donation"]
  },
];
export const WORKFLOW_HELP_GUIDES = Object.freeze(guides.map((entry, i) => Object.freeze({
  ...entry, id: "built-in-workflow-help-" + i, updated_at: updated
})));
export const workflowHelpGuide = (slug) => WORKFLOW_HELP_GUIDES.find((guide) => guide.slug === slug);
