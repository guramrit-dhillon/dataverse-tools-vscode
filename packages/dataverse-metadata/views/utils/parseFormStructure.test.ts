// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { parseFormStructure } from './parseFormStructure';

const MINIMAL_FORM_JSON = JSON.stringify({
  Tabs: [{
    Name: "tab1",
    Label: "General",
    Columns: [{
      Sections: [{
        Name: "section1",
        Label: "Contact Information",
        Rows: [{
          Cells: [
            { Label: "First Name", Control: { Id: "firstname", DataFieldName: "firstname" } },
            { Label: "Last Name",  Control: { Id: "lastname",  DataFieldName: "lastname" } },
          ]
        }]
      }]
    }]
  }],
  FormLibraries: {
    Libraries: [
      { Name: "new_/js/contact.js", DisplayName: "Contact Scripts" }
    ]
  },
  EventHandlers: [
    { EventName: "OnLoad", FunctionName: "Contact.onLoad", LibraryName: "new_/js/contact.js" },
    { EventName: "OnChange", ControlId: "firstname", FunctionName: "Contact.onChange", LibraryName: "new_/js/contact.js" }
  ]
});

describe('parseFormStructure', () => {
  it('returns empty structure for null', () => {
    expect(parseFormStructure(null)).toEqual({ tabs: [], libraries: [], events: [] });
  });

  it('returns empty structure for undefined', () => {
    expect(parseFormStructure(undefined)).toEqual({ tabs: [], libraries: [], events: [] });
  });

  it('returns empty structure for invalid JSON', () => {
    expect(parseFormStructure('not-json')).toEqual({ tabs: [], libraries: [], events: [] });
  });

  it('parses tabs and sections', () => {
    const result = parseFormStructure(MINIMAL_FORM_JSON);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].label).toBe('General');
    expect(result.tabs[0].sections).toHaveLength(1);
    expect(result.tabs[0].sections[0].label).toBe('Contact Information');
  });

  it('parses fields with logicalName and label', () => {
    const result = parseFormStructure(MINIMAL_FORM_JSON);
    const fields = result.tabs[0].sections[0].fields;
    expect(fields).toHaveLength(2);
    expect(fields[0]).toEqual({ logicalName: 'firstname', label: 'First Name', isPcf: false });
    expect(fields[1]).toEqual({ logicalName: 'lastname',  label: 'Last Name',  isPcf: false });
  });

  it('parses libraries', () => {
    const result = parseFormStructure(MINIMAL_FORM_JSON);
    expect(result.libraries).toEqual([
      { webResourceName: 'new_/js/contact.js', displayName: 'Contact Scripts' }
    ]);
  });

  it('parses event handlers — OnLoad has null field', () => {
    const result = parseFormStructure(MINIMAL_FORM_JSON);
    expect(result.events[0]).toEqual({
      event: 'OnLoad', field: null, functionName: 'Contact.onLoad', libraryName: 'new_/js/contact.js'
    });
  });

  it('parses event handlers — OnChange has field', () => {
    const result = parseFormStructure(MINIMAL_FORM_JSON);
    expect(result.events[1]).toEqual({
      event: 'OnChange', field: 'firstname', functionName: 'Contact.onChange', libraryName: 'new_/js/contact.js'
    });
  });

  it('skips cells without a Control', () => {
    const json = JSON.stringify({
      Tabs: [{ Name: "t1", Label: "T", Columns: [{ Sections: [{ Name: "s1", Label: "S", Rows: [{ Cells: [
        { Label: "No control here" },
        { Label: "Has control", Control: { Id: "name", DataFieldName: "name" } }
      ]}]}]}] }],
      FormLibraries: { Libraries: [] },
      EventHandlers: []
    });
    const result = parseFormStructure(json);
    expect(result.tabs[0].sections[0].fields).toHaveLength(1);
    expect(result.tabs[0].sections[0].fields[0].logicalName).toBe('name');
  });

  it('marks PCF controls', () => {
    const PCF_CLASS_ID = '{F9A8A302-114E-466A-B582-6771B2AE0D92}';
    const json = JSON.stringify({
      Tabs: [{ Name: "t1", Label: "T", Columns: [{ Sections: [{ Name: "s1", Label: "S", Rows: [{ Cells: [
        { Label: "Rating", Control: { Id: "new_rating", DataFieldName: "new_rating", ClassId: PCF_CLASS_ID } }
      ]}]}]}] }],
      FormLibraries: { Libraries: [] },
      EventHandlers: []
    });
    const result = parseFormStructure(json);
    expect(result.tabs[0].sections[0].fields[0].isPcf).toBe(true);
  });

  it('marks controls with ComponentType as PCF', () => {
    const json = JSON.stringify({
      Tabs: [{ Name: "t1", Label: "T", Columns: [{ Sections: [{ Name: "s1", Label: "S", Rows: [{ Cells: [
        { Label: "Custom", Control: { Id: "new_custom", DataFieldName: "new_custom", ComponentType: 5 } }
      ]}]}]}] }],
      FormLibraries: { Libraries: [] },
      EventHandlers: []
    });
    const result = parseFormStructure(json);
    expect(result.tabs[0].sections[0].fields[0].isPcf).toBe(true);
  });
});
