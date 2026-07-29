# Roll out archive readers before writers

Archive format changes ship readers before writers: both clients first gain and verify version 2 import while continuing to export legacy version 1, and version 2 export is enabled only after compatible readers are released. Version 1 import remains supported indefinitely, while version 1 export may remain temporarily for compatibility with older installed clients.
