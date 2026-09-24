import React, { useState } from "react";
import { toast } from "react-toastify";
import CustomButton from "../fields/CustomButton";
import GridContainer from "../fields/GridContainer";
import InputSuggestions from "../fields/InputSuggestions";
import TableComponent from "../table/TableComponent";
import CustomModal from "../modal/CustomModal";
import AddExaminer from "../AddExaminer/AddExaminer";
import { customFetch } from "../../../api/base";
import { baseURL } from "../../../api/urls";
import { insertAt, toastUndo } from "../../../utils/undoToast";

// One list of examiners (Field::examiners on the server): search the
// directory or add a new one through a dialog, and remove one. A row already
// saved on the form is deleted on the server at once, after a confirm; one
// only added in this sitting is dropped, with an Undo.
const ExaminerList = ({ field, entries, setEntries, everyone }) => {
  const [dialogData, setDialogData] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  // The saved row being deleted, so its button cannot send a second DELETE.
  const [removing, setRemoving] = useState(null);
  // Marks where the examiner just added landed in the table.
  const [lastAdded, setLastAdded] = useState(null);

  const open = (data) => {
    setDialogData(data);
    setDialogOpen(true);
  };

  const add = (examiner) => {
    setEntries((now) => [...now, examiner]);
    setLastAdded(examiner);
    setDialogOpen(false);
  };

  const drop = (examiner) => {
    const index = entries.indexOf(examiner);
    setEntries((now) => now.filter((row) => row !== examiner));
    if (!examiner.id) {
      toastUndo(`${examiner.name || "Examiner"} removed.`, () => setEntries((now) => insertAt(now, index, examiner)));
    }
  };

  const remove = async (row) => {
    if (row.id) {
      if (!window.confirm(`Remove ${row.name || "this examiner"} from the list? The saved examiner is deleted straight away.`)) return;
      setRemoving(row);
      const res = await customFetch(baseURL + field.remove_path.replace("{id}", row.id), "DELETE");
      setRemoving(null);
      if (!res || !res.success) return;
      toast.success("Examiner removed");
    }
    drop(row);
  };

  const canEdit = field.editable;

  return (
    <div>
      <CustomModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        minWidth="700px"
        maxWidth="800px"
        minHeight="300px"
        maxHeight="500px"
      >
        <AddExaminer data={dialogData} onSubmit={add} existing={everyone} />
      </CustomModal>
      {canEdit && (
        <GridContainer
          elements={[
            <InputSuggestions
              apiUrl={baseURL + field.source}
              hint="Search here..."
              onSelect={open}
              label=""
              showLabel={false}
            />,
            <CustomButton text={field.add_label} variant="secondary" onClick={() => open({})} />,
          ]}
          ratio={[2, 1]}
          space={2}
          label={field.label}
        />
      )}
      {field.table && (
        <GridContainer
          elements={[
            <TableComponent
              data={entries}
              rowClassName={(row) => (row === lastAdded ? "just-added" : undefined)}
              titles={["Name", "Email", "Department", "Designation", "Institution", "Status", ...(canEdit ? [""] : [])]}
              keys={["name", "email", "department", "designation", "institution", "recommendation", ...(canEdit ? ["remove"] : [])]}
              components={
                canEdit
                  ? [
                      {
                        key: "remove",
                        component: ({ row }) =>
                          row.recommendation && row.recommendation !== "pending" ? null : (
                            <button
                              type="button"
                              className="examiner-remove"
                              aria-label={`Remove ${row.name}`}
                              onClick={() => remove(row)}
                              disabled={removing === row}
                            >
                              <i className="fa fa-trash" aria-hidden="true"></i>
                            </button>
                          ),
                      },
                    ]
                  : []
              }
            />,
          ]}
          space={3}
        />
      )}
    </div>
  );
};

export default ExaminerList;
