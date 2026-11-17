

## Overview

`hmt_apps` is a repository for developing single-page webapps using the datasets built by the Homer Multitext project and published in a single delimited-text file at https://raw.githubusercontent.com/homermultitext/hmt-archive/refs/heads/master/releases-cex/hmt-current.cex





## Functionality

Each of the apps developed in this repository should be contained in a single HTML file that can function either when served from a web server, or when opened from a local file. Code reused in multiple notebooks can be shared for better single-source maintenance and development, and the indiidual HTML files assembled in a build project.

The common preliminary step for all apps is to load the current HMT data set and parse its contents, described next.


## Source data

### File organization

The HMT release file is a plain text file. The data are organized in blocks begining with one of the following headings as a complete line:


- `#!cexversion`
- `#!citelibrary`
- `#!citecollections`
- `#!citeproperties`
- `#!citedata`
- `#!datamodels`
- `#!ctscatalog`
- `#!ctsdata`
- `#!citerelationset`



All lines following a header line until the next header belong to the data block of the first, labelling header line. Lines beginning with `//` are comments and should be ignored. Empty lines are allowed and are also ignored. 

Apps must be able to retrieve data for a requested block type.Other than `#!cexversion` and `#!citelibrary`, all blocks are repeatable, and retrieving data for a given block type should produce a composite of the contents of all blocks with that type. E.g., retrieve `#!ctsdata` should produce a single result with the full contents of all `#!ctsdata` blocks.

The format of individual blocks is described next.

### Block with a simple string value for CEX version

`#!cexversion`: a single data value with a string identifying the CEX version used in this library.

### Block structures with metadata in `key|value` format.

The pipe character `|` is a delimiter used to structure the data in each block as follows.


`#!citelibrary`: data formatted as key-value pairs, delimited by `|`. The keys `name`, `urn` and `license` all have a simple string value. They `namespace` has *two* `|`-separated values giving an abbreviation and a full URI for a URN namespace, e.g., the line `namespace|greekLit|http://chs.harvard.edu/ctsns/greekLit` defines a URN namespace abbreviated `greekLit` with URI `http://chs.harvard.edu/ctsns/greekLit`.


### Block structures for citable data collections

`#!citecollections` has delimited tabular data with the header line `URN|Description|Labelling property|Ordering property|License` defining metadata about a collection identified by a collection-level CITE2 URN (the `URN` value).


`#!citeproperties` has delimited tabular data with the header line `Property|Label|Type|Authority list` defining metadata about individual properties in a collection, with the property identified by a property-level CITE2 URN (the `Property` value).

`#!citedata` has delimited tabular data with a header line specific to the collection. This block contains the actual data of the collection. The header lines are taken from the values for documented properties for the collection.

Example: 

`There is a #!citedata block with header line `sequence|image|urn|rv|label` and values for `urn` like `urn:cite2:citebl:burney86pages.v1:1r`. That is, the data belong to a collection `urn:cite2:citebl:burney86pages.v1:` that must be documented in a `#!citecollections` block. Each of the properties `sequence|image|urn|rv|label` must be documented in a `#!citeproperties` block, identified by values like  `urn:cite2:citebl:burney86pages.v1.sequence:`, ` `urn:cite2:citebl:burney86pages.v1.image:` ...


Consistency checks to enforce: 

- in `#!citecollections`: `URN` must be a collection-level CITE2 URN value. The `Labelling property` value must be documented in a `#!citeproperties` block; if a value is included for `Ordering property`, it must be documented in a `#!citeproperties` block.

- `#!citeproperties`: for each property-level URN like `urn:cite2:citebl:burney86pages.v1.sequence:`, the collection (here, `urn:cite2:citebl:burney86pages.v1:`) must be documented in a `#!citecollections` block.


- `#!citedata`: each property name in the header line must be documented in a `citeproperties` entry.






### Block structures for other data relations

`#!datamodels` has delimited tabular data with the header line `Collection|Model|Label|Description`. `Collection` is a CITE2 URN identifying a collection documented in a `#!citecollections` block. `Model` is a CITE2 URN value referrring to an external data model.



`#!citerelationset` is a block including both `key|value` and delimited-table content. It begins with key-value pairs for `urn` identifying a relation set, and for `label`. This is followed by a table with a header specific to the kind of relations. `#!citerelationset` entries should be keyed to a datamodel: the `urn` of a `citerelationset` should have a corresponding `Collection` entry in a `datamodels` block.



### Block structures for citable texts


`#!ctscatalog` has the header line `urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language`. The `urn` value identifies a specific version of a text.


`#!ctsdata` has no header line. Non-empty, non-comment data blocks have two `|`-separated values, a CTS URN at the passage level, and the text content of a passage. Passage URNs should have a corresponding version-level entry (with no passage value) in a `ctscatalog` block.




## Architecture & Directory Structure

- `quarto`, `docs`, `README.md`, `releases.md`, and `version.txt` are all user-readable content owned by me; Claude should not touch them
- `notes` is for documentation and notes that Claude writes, includes session summaries so I can reliably pick up working with Claude from different machines
- `src` is for source code


## Testing Guidelines

- Write unit tests for utility functions and integration/component tests for critical UI flows.
- Run relevant tests before proposing significant refactors.