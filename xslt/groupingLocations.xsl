<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:t="http://www.tei-c.org/ns/1.0"
  xmlns="http://www.tei-c.org/ns/1.0"
  exclude-result-prefixes="xs"
  version="3.0">
  <xsl:output indent="yes"/>

  <!-- This just speeds up the process of grabbing rows by planceNames a little -->
  <xsl:key name="PLACES" match="t:row" use="t:cell[@n='5']/t:placeName/normalize-space()"/>

  <!-- "Identity transform" template. Copies everything but the <text> -->
  <xsl:template match="node()|@*|*|processing-instruction()|comment()">
    <xsl:copy>
      <xsl:apply-templates select="node()|@*|*|processing-instruction()|comment()"/>
    </xsl:copy>
  </xsl:template>

  <!-- Matches the <text> and puts in a list instead the original content-->
  <xsl:template match="t:text">
    <!-- Gets a list of placeNames that occur in column 5 -->
    <xsl:variable name="places" select="sort(distinct-values(//t:cell[@n=5]/t:placeName/normalize-space()))"/>
    <!-- <xsl:for-each> changes the context (what's accessible to XPath).
      We want a copy so we can get back out of our place list when we're
      iterating over it to the main document -->
    <xsl:variable name="context" select="."/>
    <text>
      <body>
        <list xml:id="locations" type="firstList">
          <head xml:id="headLocations">Locations</head>
          <xsl:for-each select="$places">
            <item n="1place"><placeName><xsl:value-of select="."/></placeName>
              <list type="secondList">
                <!-- Go and get each row where column 5 contains the current place -->
                <xsl:for-each select="$context/key('PLACES',current())">
                  <xsl:sort select="normalize-space(t:cell[@n='4'])"></xsl:sort>
                  <item><ref target="pages/chrono.html#{@xml:id}"><xsl:apply-templates select="t:cell[@n='4']/node()"/></ref></item>
                </xsl:for-each>
              </list>
            </item>
          </xsl:for-each>
        </list>
      </body>
    </text>
  </xsl:template>

  <xsl:template match="@full|@instant"/>

</xsl:stylesheet>
