import { useEffect, useState } from 'react';
import { baseURL } from '../api/urls';
import { customFetch } from '../api/base';

// The broad research areas the signed-in user's department offers, ready for a
// DropdownField.
//
// The list is a fixed per-department vocabulary: only the admin page and the
// research area import add to it, so every form that asks for a broad area asks
// for one of these rather than free text. Three forms need the same list, which
// is why it lives here rather than in each of them.
export const useResearchAreas = () => {
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const response = await customFetch(baseURL + '/suggestions/specialization', 'GET', {}, false);
      if (cancelled || !response.success) return;

      const rows = response.response?.data || response.response || [];
      setAreas(rows.map((area) => ({ title: area.name, value: area.id })));
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return areas;
};

export default useResearchAreas;
