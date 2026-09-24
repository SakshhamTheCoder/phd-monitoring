import React from 'react';
import FormGrid from '../../forms/formGrid/FormGrid';

/** Forms as cards, each lit where something of that kind waits on the reader. */
const FormGridBlock = ({ props }) => <FormGrid forms={props.forms} />;

export default FormGridBlock;
