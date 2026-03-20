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

  it('handles real formjson with $values wrappers, null labels, and string libraries', () => {
    const json = JSON.stringify({
      Tabs: { $values: [{
        Label: null,
        Name: "tab_general",
        Columns: { $values: [{
          Sections: { $values: [{
            Label: null,
            Name: "section_info",
            Rows: { $values: [{
              Cells: { $values: [
                {
                  Label: null,
                  Control: {
                    Id: "indskr_name",
                    DataFieldName: "indskr_name",
                    Label: null,
                    EventHandlers: { $values: [
                      { EventName: "OnChange", FunctionName: "Ns.onNameChange", LibraryName: "new_/js/contact.js" }
                    ] }
                  }
                }
              ] }
            }] }
          }] }
        }] },
        EventHandlers: { $values: [] }
      }] },
      FormLibraries: { $values: ["new_/js/contact.js", "new_/js/utils.js"] },
      EventHandlers: { $values: [
        { EventName: "OnLoad", FunctionName: "Ns.onLoad", LibraryName: "new_/js/contact.js" }
      ] }
    });
    const result = parseFormStructure(json);

    // Structure: tab label falls back to Name
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].label).toBe('tab_general');
    expect(result.tabs[0].sections[0].label).toBe('section_info');

    // Field: label falls back to logical name when null
    const field = result.tabs[0].sections[0].fields[0];
    expect(field.logicalName).toBe('indskr_name');
    expect(field.label).toBe('indskr_name');

    // Libraries: string[] → webResourceName = displayName
    expect(result.libraries).toEqual([
      { webResourceName: 'new_/js/contact.js', displayName: 'new_/js/contact.js' },
      { webResourceName: 'new_/js/utils.js',   displayName: 'new_/js/utils.js' },
    ]);

    // Events: form-level OnLoad + control-level OnChange
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toEqual({ event: 'OnLoad', field: null, functionName: 'Ns.onLoad', libraryName: 'new_/js/contact.js' });
    expect(result.events[1]).toEqual({ event: 'OnChange', field: 'indskr_name', functionName: 'Ns.onNameChange', libraryName: 'new_/js/contact.js' });
  });
});
