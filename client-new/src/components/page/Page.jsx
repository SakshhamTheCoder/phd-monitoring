import React from 'react';
import PageHeader from '../pageHeader/PageHeader';

/**
 * Every signed-in page: the header band, then its panels. The gap between the
 * header and the first panel, and between panels, lives here and nowhere else,
 * so no page adds a wrapper with its own padding or margin.
 *
 *   <Page title="Manage users" description="..." actions={<CustomButton ... />}>
 *     <PagenationTable ... />
 *   </Page>
 *
 * `tabs` takes a <Tabs> and draws it under the title. `meta` is a line of
 * badges or ids about the record the page is showing.
 */
const Page = ({ title, description, meta, actions, tabs, className = '', children }) => (
  <div className={`page ${className}`.trim()}>
    {title && <PageHeader title={title} description={description} meta={meta} actions={actions} tabs={tabs} />}
    {children}
  </div>
);

export default Page;
