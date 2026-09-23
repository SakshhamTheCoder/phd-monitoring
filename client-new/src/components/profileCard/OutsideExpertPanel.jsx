import React, { useState } from "react";
import Panel from "../panel/Panel";
import TableComponent from "../forms/table/TableComponent";
import InputSuggestions from "../forms/fields/InputSuggestions";
import CustomButton from "../forms/fields/CustomButton";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import { toast } from "react-toastify";

/**
 * The IRB committee's member from outside the institute. The rest of the IRB
 * committee is the doctoral committee above, so this is the one name the page
 * has to add. The revised IRB's external review goes to them.
 *
 * Someone who manages students can set or change it: a scholar carried over
 * from before the portal can have a committee and no expert, and their revised
 * IRB then skips the external review.
 */
const OutsideExpertPanel = ({ expert, canManage, rollNo, onSaved }) => {
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await customFetch(`${baseURL}/students/${rollNo}/outside-expert`, "POST", { outside_expert_id: picked.id });
    setSaving(false);
    if (res.success) {
      toast.success(res.response.message);
      setPicked(null);
      onSaved();
    }
  };

  return (
    <Panel flush title="IRB outside expert">
      {expert ? (
        <TableComponent
          data={[expert]}
          keys={["name", "email", "designation", "institution"]}
          titles={["Name", "Email", "Designation", "Institution"]}
        />
      ) : (
        <p className="profile-panel-note profile-panel-note--muted">
          None on record. The revised IRB goes from the supervisors straight to the doctoral committee, with no external review.
        </p>
      )}
      {canManage && rollNo && (
        <div className="profile-panel-note outside-expert-picker">
          <InputSuggestions
            apiUrl={`${baseURL}/suggestions/outside-expert`}
            label={expert ? "Change outside expert" : "Set outside expert"}
            hint="Search by name, email or institution"
            fields={["name", "institution"]}
            onSelect={setPicked}
          />
          <CustomButton text="Save" onClick={save} busy={saving} disabled={!picked} />
        </div>
      )}
    </Panel>
  );
};

export default OutsideExpertPanel;
