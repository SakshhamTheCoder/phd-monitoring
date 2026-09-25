import React from 'react';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import Page from '../../components/page/Page';
import { useView } from '../../api/views';

/**
 * The forms menu for the roles that read scholars' forms: one card per form
 * type, the list being the server's (App\Pages\FormsMenuPage).
 */
const FacultyFormsPage = () => {
  const { view } = useView('forms-menu');

  return (
    <Page title={view?.title ?? 'Forms'}>
      <FormGrid forms={view?.forms ?? []} loading={!view} />
    </Page>
  );
};

export default FacultyFormsPage;
