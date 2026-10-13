# Google sitelinks

Google automatically selects organic sitelinks; website code cannot mandate a particular set or guarantee their appearance. Official guidance: https://developers.google.com/search/docs/appearance/sitelinks.

The public site exposes Features, Articles, About, FAQ and Open Source through ordinary server-rendered links. Footer link groups are labelled navigation landmarks. Features and Articles now have explicit product/page headings; the homepage WebSite schema has a stable identifier and Qurtiz alternate name. Login and Get started links remain visible with consistent labels.

Authentication pages deliberately remain noindex and outside the sitemap, following the approved SEO scope. Do not promise Login or Signup organic sitelinks while that policy is retained. No private routes should become indexable for cosmetic search-result changes.

The sitemap is accepted by Search Console with 20 discovered pages. As verified October 3, the homepage is indexed; the Articles index is not yet indexed and its indexing request hit Google's daily quota. Other public pages must be crawled/indexed before Google can choose useful sitelinks. No repeated indexing requests or schema tricks should be used to bypass this.

Changes in this pass are local until deployed. Search Console and Google search appearance are independent of a successful production build. No new indexing request was made in this pass.
