import React, { useState } from "react";
import DropdownField from "../forms/fields/DropdownField";
import GridContainer from "../forms/fields/GridContainer";
import ServerPanel from "../forms/serverForm/ServerPanel";
import { startingFrom } from "../serverPage/ServerDialog";
import { useView } from "../../api/views";
import { APIaddPublication, APIupdatePublication } from "../../api/publication";

/**
 * Adds or edits a publication. The kinds offered and the fields each asks for
 * are the server's (GET /views/publication-form, App\Pages\PublicationFormPage),
 * drawn by the server form renderer; a record being edited fills them.
 *
 * onSave lets a caller send the record somewhere other than the student
 * publication endpoints; a faculty member's own record asks fewer fields.
 */
const AddPublication = ({ close, editData = null, onSave = null }) => {
  const { view } = useView("publication-form", onSave ? { faculty: 1 } : {});
  // The faculty profile stores a patent as the singular 'patent'; the form
  // below is keyed on 'patents', and apiUpdateFacultyPublication maps it back.
  const [kind, setKind] = useState(
    editData?.publication_type === "patent" ? { ...editData, publication_type: "patents" } : editData || {}
  );
  const [saving, setSaving] = useState(false);

  // The dialog names itself by its heading as it opens, so the heading is
  // there before the form's description is, in the place the no-kind heading
  // takes below, so it stays the same element (and keeps the name) after.
  if (!view) return <>{false}<h1 className="modal-title">Choose a publication type</h1></>;

  // Submit stays held until the save answers, so a second click cannot post
  // the same publication twice.
  const save = async (values, files) => {
    if (saving) return;
    const body = { ...kind, ...values, ...(files.first_page ? { first_page: files.first_page } : {}) };
    setSaving(true);
    try {
      if (onSave) {
        await onSave(body);
      } else if (editData && editData.id) {
        await APIupdatePublication(editData.id, body, close, body.publication_type === "patents" ? "/patents" : false);
      } else {
        await APIaddPublication(body, close, body.publication_type === "patents" ? "/patents" : false);
      }
    } finally {
      setSaving(false);
    }
  };

  const rows = kind.publication_type ? view.forms[kind.publication_type] : null;

  return (
    <>
        {/* Two headings rather than one retitled: the dialog names itself by the
            first, and the chosen kind's heading is a new one. */}
        {kind.label && (<h1 className="modal-title">{kind.label}</h1>)}
        {!kind.label && (<h1 className="modal-title">{view.title}</h1>)}
        {!editData && (
          <GridContainer
            elements={[
              <DropdownField
                label={view.choose}
                options={view.kinds.map((each) => ({ value: JSON.stringify(each), title: each.label }))}
                // A new kind starts a new form: the last kind's answers are not posted with this one.
                onChange={(value) => setKind(JSON.parse(value))}
              />,
            ]}
            space={2}
          />
        )}

        {/* Keyed on the kind so its form remounts empty. */}
        <div className="add-publication-box" key={kind.label}>
          {rows && (kind.label || editData) ? (
            <ServerPanel rows={startingFrom(rows, editData || {})} wrapped={false} host={{ submit: save, busy: saving }} />
          ) : null}
        </div>
    </>
  );
};

export default AddPublication;
