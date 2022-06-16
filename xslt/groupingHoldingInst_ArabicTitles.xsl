<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    xmlns:t="http://www.tei-c.org/ns/1.0"
    xmlns="http://www.tei-c.org/ns/1.0"
    exclude-result-prefixes="xs"
    version="3.0">
    <xsl:output indent="yes"/>
    
    <!-- "Identity transform" template. Copies everything but the <text> -->
    <xsl:template match="node()|@*|*|processing-instruction()|comment()">
        <xsl:copy>
            <xsl:apply-templates select="node()|@*|*|processing-instruction()|comment()"/>
        </xsl:copy>
    </xsl:template>
    
    <!-- Matches the <text> and puts in a list instead the original content-->
    <xsl:template match="t:text">
        <!-- <xsl:for-each> changes the context (what's accessible to XPath).
      We want a copy so we can get back out of our place list when we're
      iterating over it to the main document -->
        <xsl:variable name="context" select="."/>
        <text>
            <body>
                <list xml:id="institutions" type="firstList">
                    <head xml:id="headInstitutions">Holding Institutions</head>
                    <xsl:for-each select="id('dAbbr')//t:p">
                        <xsl:sort select="t:abbr"/>
                        <xsl:variable name="ref">#<xsl:value-of select="@xml:id"/></xsl:variable>
                        <item n="1institutions"><orgName><ref target="pages/abbrev.html#{@xml:id}"><xsl:apply-templates select=".//t:abbr/node()"/></ref></orgName>
                            <list type="holdings">
                                
                                <!-- Go and get each cell 9 where xml:id of institution is and display the name in cell 4-->
                                <xsl:for-each select="$context//t:rs[@ref=$ref]">
                                    <xsl:sort select="normalize-space(ancestor::t:row/t:cell[@n='10'])"/>
                                
                                    <item><ref target="pages/chrono.html#{ancestor::t:row[1]/@xml:id}"><xsl:apply-templates select="ancestor::t:row/t:cell[@n='10']/node()"/></ref></item>
                                    
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