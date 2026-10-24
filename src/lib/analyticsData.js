const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_RECORDS = 100000;
const DEFAULT_CONCURRENCY = 6;

export const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
export const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
export const isEntityList = (value) => Array.isArray(value) && value.every((item) => isRecord(item) && isNonEmptyString(item.id));
export const isDonationList = (value) => Array.isArray(value) && value.every((item) => isRecord(item) && isNonEmptyString(item.id) && Number.isFinite(Number(item.amount)));

export async function collectCursorPages(readPage, { pageSize = DEFAULT_PAGE_SIZE, maxRecords = DEFAULT_MAX_RECORDS } = {}) {
  const records = [];
  let cursor = null;
  do {
    const page = await readPage(cursor, pageSize);
    if (!isRecord(page) || !isEntityList(page.items) || typeof page.has_more !== "boolean") {
      throw new Error("Malformed analytics page");
    }
    if (records.length + page.items.length > maxRecords) {
      throw new Error("Analytics result exceeds safe limit");
    }
    records.push(...page.items);
    if (!page.has_more) return records;
    if (!isNonEmptyString(page.next_cursor)) throw new Error("Malformed analytics cursor");
    cursor = page.next_cursor;
  } while (true);
}

export async function mapWithConcurrency(items, worker, concurrency = DEFAULT_CONCURRENCY) {
  if (!Array.isArray(items) || !Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Invalid analytics work queue");
  }
  const results = new Array(items.length);
  let nextIndex = 0;
  let failed = false;
  async function run() {
    while (!failed) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

const listAll = (entity) => collectCursorPages((cursor, limit) => entity.list({ sort: "-created_date", limit, cursor }));
const filterAll = (entity, query) => collectCursorPages((cursor, limit) => entity.filter(query, { sort: "-created_date", limit, cursor }));

export async function loadAnalyticsData(base44, userId) {
  if (!isRecord(base44) || !isNonEmptyString(userId)) throw new Error("Invalid analytics request");

  const [campaigns, communities, institutions, volunteerOpps, applications, opportunities] = await Promise.all([
    filterAll(base44.entities.Campaign, { created_by_id: userId }),
    listAll(base44.entities.Community),
    listAll(base44.entities.Institution),
    listAll(base44.entities.VolunteerOpportunity),
    filterAll(base44.entities.GrantApplication, { applicant_user_id: userId }),
    listAll(base44.entities.InstitutionOpportunity),
  ]);

  const donationLists = await mapWithConcurrency(campaigns, async (campaign) => {
    const response = await base44.functions.invoke("getCampaignDonations", {
      campaign_id: campaign.id,
      analytics_complete: true,
    });
    if (!isRecord(response) || !isRecord(response.data) || response.data.complete !== true || !isDonationList(response.data.donations)) {
      throw new Error("Incomplete analytics donation response");
    }
    return response.data.donations;
  });

  const signupLists = await mapWithConcurrency(volunteerOpps, (opportunity) => (
    filterAll(base44.entities.VolunteerSignup, { opportunity_id: opportunity.id })
  ));

  const donations = donationLists.flat();
  const signups = signupLists.flat();
  if (!isDonationList(donations) || !isEntityList(signups)) throw new Error("Malformed analytics response");

  return { campaigns, communities, institutions, volunteerOpps, applications, opportunities, donations, signups };
}
