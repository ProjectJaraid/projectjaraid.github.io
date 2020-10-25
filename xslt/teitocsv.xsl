<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:t="http://www.tei-c.org/ns/1.0"
  exclude-result-prefixes="xs"
  version="3.0">
  <!-- The namespace declaration above lets the XSLT "see" element in the TEI namespace. -->
  <xsl:output method="text" encoding="UTF-8" name="out"/>
  <xsl:strip-space elements="*"/>
  <xsl:variable name="newline"><xsl:text>&#x0D;&#x0A;</xsl:text></xsl:variable>
  
  <xsl:template match="/">
    <xsl:for-each select="//t:table">
      <!-- This will output a different document for eqch table, named after the table id. -->
      <!-- The replace functions are turning newlines and extra space into a single space, and turning " characters into "" -->
      <xsl:result-document format="out" href="{@xml:id}.csv"><xsl:for-each select="t:row">"<xsl:value-of select="if (@xml:id) then @xml:id else 'ID'"/>",<xsl:for-each select="t:cell"><xsl:if test="not(matches(.,'^[0-9]+$'))">"</xsl:if><xsl:value-of select="normalize-space(replace(.,'&quot;','&quot;&quot;'))"/><xsl:if test="not(matches(.,'^[0-9]+$'))">"</xsl:if><xsl:if test="position() != last()">,</xsl:if></xsl:for-each><xsl:value-of select="$newline" />
        </xsl:for-each></xsl:result-document>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>