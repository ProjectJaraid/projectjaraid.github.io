<xsl:stylesheet version="1.0"
xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="text" encoding="UTF-8"/>
 <xsl:strip-space elements="*"/>
 <xsl:variable name="separator" select="'&#59;'" />
<xsl:variable name="newline" select="'&#10;'" />

<xsl:template match="/">

<xsl:for-each select="list/row">
  <xsl:value-of select="//@xml:id"/>,
  <xsl:value-of select="cell"/>,
 <xsl:value-of select="$newline" />
</xsl:for-each>

</xsl:template>

</xsl:stylesheet>
