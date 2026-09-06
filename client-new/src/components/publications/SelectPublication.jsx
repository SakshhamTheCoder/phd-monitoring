import React from "react";

const SelectPublication = ({
  onSelect,
  sci = true,
  non_sci = true,
  international = true,
  national,
  book = true,
  patents = true,
}) => {
  const [publication, setPublication] = useState({});
  const [selected, setSelected] = useState({});

  const handleSelect = (e) => {
    let value=e.target.value;
    switch(value.type){
        
    }
  };
  return <>
    
  </>;
};

export default SelectPublication;
